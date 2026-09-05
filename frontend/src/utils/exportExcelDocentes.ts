import ExcelJS from 'exceljs';

export interface DocenteExportData {
  nombres: string;
  apellidos: string;
  correo: string;
  tipo_documento?: string;
  numero_documento?: string;
  programa?: string;
  facultad?: string;
  tipo_contrato?: string;
  roles?: string;
  activo: boolean;
}

export async function exportarDocentesExcel(
  docentes: DocenteExportData[],
  periodoNombre?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGAP - Universidad CESMAG';
  workbook.lastModifiedBy = 'SIGAP';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Docentes y Usuarios', {
    views: [{ showGridLines: true }]
  });

  // Anchos de columna
  worksheet.columns = [
    { key: 'nombres', width: 24 },
    { key: 'apellidos', width: 24 },
    { key: 'tipo_doc', width: 16 },
    { key: 'numero_doc', width: 20 },
    { key: 'correo', width: 34 },
    { key: 'programa', width: 28 },
    { key: 'facultad', width: 24 },
    { key: 'contrato', width: 20 },
    { key: 'roles', width: 26 },
    { key: 'estado', width: 16 }
  ];

  // 1. Cargar e insertar Logo de CESMAG
  try {
    const response = await fetch('/logo_cesmag.png');
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const imageId = workbook.addImage({
        buffer,
        extension: 'png'
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.15, row: 0.2 },
        br: { col: 1.85, row: 4.8 }
      } as any);
    }
  } catch (err) {
    console.warn('No se pudo cargar el logo de CESMAG para el Excel:', err);
  }

  // 2. Banner de Encabezado Institucional (C1:J4)
  worksheet.mergeCells('C1:J4');
  const bannerCell = worksheet.getCell('C1');
  bannerCell.value = {
    richText: [
      { text: 'UNIVERSIDAD CESMAG\n', font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' } },
      { text: 'SISTEMA INTEGRADO DE GESTIÓN ACADÉMICA PROFESORAL (SIGAP)\n', font: { bold: true, size: 11, color: { argb: 'FFE2E8F0' }, name: 'Calibri' } },
      { text: `Reporte Oficial de Docentes y Usuarios Registrados ${periodoNombre ? `· ${periodoNombre}` : ''}`, font: { italic: true, size: 10, color: { argb: 'FFCBD5E1' }, name: 'Calibri' } }
    ]
  };
  bannerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A2744' } // Azul marino institucional
  };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // Fila 5: Espaciador
  worksheet.getRow(5).height = 10;

  // Fila 6: Barra de Información de Generación (A6:J6)
  worksheet.mergeCells('A6:J6');
  const infoCell = worksheet.getCell('A6');
  const fechaGeneracion = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  infoCell.value = `📅 Reporte generado el ${fechaGeneracion} | Total Registros: ${docentes.length} | Activos: ${docentes.filter(d => d.activo).length} | Inactivos: ${docentes.filter(d => !d.activo).length}`;
  infoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }
  };
  infoCell.font = { italic: true, size: 9, color: { argb: 'FF475569' } };
  infoCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(6).height = 24;

  // Fila 7: Espacio
  worksheet.getRow(7).height = 8;

  // Fila 8: Encabezados de Columnas
  const headers = [
    'Nombres',
    'Apellidos',
    'Tipo Doc.',
    'No. Identificación',
    'Correo Institucional',
    'Programa Académico',
    'Facultad',
    'Tipo Contrato',
    'Roles de Acceso',
    'Estado'
  ];

  const headerRow = worksheet.getRow(8);
  headerRow.height = 26;

  headers.forEach((hText, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = hText;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A2744' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // Fila 9+: Filas de Datos
  docentes.forEach((d, rowIndex) => {
    const rowNum = 9 + rowIndex;
    const row = worksheet.getRow(rowNum);
    row.height = 21;

    const isEven = rowIndex % 2 === 0;
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    const isPl = (d.roles || '').toLowerCase().includes('plane');
    const isCo = (d.roles || '').toLowerCase().includes('consult');
    const isOnlyPlOrCo = (isPl || isCo) && !(d.roles || '').toLowerCase().includes('docent') && !(d.roles || '').toLowerCase().includes('direct');

    const rowValues = [
      d.nombres,
      d.apellidos,
      d.tipo_documento || 'CC',
      d.numero_documento || '0000000000',
      d.correo,
      isOnlyPlOrCo ? 'No aplica' : (d.programa || 'Sin Asignar'),
      isOnlyPlOrCo ? 'No aplica' : (d.facultad || 'Ingeniería'),
      d.tipo_contrato || 'Hora Cátedra',
      d.roles || 'Docente',
      d.activo ? 'Habilitado' : 'Bloqueado'
    ];

    rowValues.forEach((val, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = val;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.font = { size: 9.5, color: { argb: 'FF1E293B' } };
      
      // Alineaciones específicas
      if (colIndex === 2 || colIndex === 3 || colIndex === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Estilo especial para la columna Estado
      if (colIndex === 9) {
        cell.font = {
          bold: true,
          size: 9.5,
          color: { argb: d.activo ? 'FF15803D' : 'FFB91C1C' } // Verde si activo, rojo si bloqueado
        };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // Generar y descargar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `docentes_SIGAP_${new Date().toISOString().split('T')[0]}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
