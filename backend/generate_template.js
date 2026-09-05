const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGAP - Universidad CESMAG';
    workbook.lastModifiedBy = 'SIGAP';
    workbook.created = new Date();

    // ==========================================
    // HOJA 1: Plantilla de Importación Masiva
    // ==========================================
    const worksheet = workbook.addWorksheet('Importar Usuarios', {
        views: [{ showGridLines: true }]
    });

    // Anchos de Columna
    worksheet.columns = [
        { key: 'nombres', width: 26 },
        { key: 'apellidos', width: 26 },
        { key: 'tipo_documento', width: 20 },
        { key: 'numero_documento', width: 24 },
        { key: 'correo', width: 36 },
        { key: 'roles', width: 30 },
        { key: 'programa', width: 32 }
    ];

    // Logo CESMAG (Filas 1 a 4, Columnas A a B)
    const logoPath = path.join(__dirname, '..', 'frontend', 'public', 'logo_cesmag.png');
    if (fs.existsSync(logoPath)) {
        const imageId = workbook.addImage({
            filename: logoPath,
            extension: 'png',
        });
        worksheet.addImage(imageId, {
            tl: { col: 0.15, row: 0.2 },
            br: { col: 1.85, row: 4.8 }
        });
    }

    // Encabezado Banner Titulo (Unir C1:G4)
    worksheet.mergeCells('C1:G4');
    const headerCell = worksheet.getCell('C1');
    headerCell.value = {
        richText: [
            { text: 'UNIVERSIDAD CESMAG\n', font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' } },
            { text: 'SISTEMA INTEGRADO DE GESTIÓN ACADÉMICA PROFESORAL (SIGAP)\n', font: { bold: true, size: 11, color: { argb: 'FFE2E8F0' }, name: 'Calibri' } },
            { text: 'Plantilla Oficial de Importación Masiva de Usuarios / Docentes', font: { italic: true, size: 10, color: { argb: 'FFCBD5E1' }, name: 'Calibri' } }
        ]
    };
    headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A2744' } // Azul marino institucional
    };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Fila 5: Espacio en blanco
    worksheet.getRow(5).height = 10;

    // Fila 6: Fila de Instrucciones (Unir A6:G6)
    worksheet.mergeCells('A6:G6');
    const instructionCell = worksheet.getCell('A6');
    instructionCell.value = '📌 INSTRUCCIONES: Diligencie sus datos a partir de la fila 10. La fila 9 es una fila de marca de agua/guía informativa. Los campos con (*) son obligatorios. Para múltiples roles sepárelos por coma (ej. Docente, Director). Para Consultor o Planeación sin programa use "No aplica". Consulte la hoja "Guía y Ejemplos" para más detalles.';
    instructionCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };
    instructionCell.font = { italic: true, size: 9, color: { argb: 'FF334155' } };
    instructionCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    worksheet.getRow(6).height = 32;

    // Fila 7: Espacio
    worksheet.getRow(7).height = 8;

    // Fila 8: Encabezados de la Tabla
    const headers = [
        'Nombres *',
        'Apellidos *',
        'Tipo Documento *',
        'Número Documento *',
        'Correo Institucional *',
        'Roles *',
        'Programa Académico'
    ];
    const headerRow = worksheet.getRow(8);
    headerRow.height = 28;

    headers.forEach((hText, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = hText;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A2744' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F172A' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } }
        };
    });

    // Fila 9: Fila Guía / Marca de agua (Watermark placeholders)
    const watermarkRow = worksheet.getRow(9);
    watermarkRow.height = 22;
    const watermarkValues = [
        'Ej: Juan Carlos',
        'Ej: Pérez Gómez',
        'CC',
        'Ej: 1085123456',
        'Ej: jperez@cesmag.edu.co',
        'Ej: Docente, Director',
        'Ej: Ingeniería de Sistemas'
    ];

    watermarkValues.forEach((val, colIndex) => {
        const cell = watermarkRow.getCell(colIndex + 1);
        cell.value = val;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' } // Gris suave distintivo
        };
        cell.font = { italic: true, size: 9.5, color: { argb: 'FF94A3B8' } }; // Marca de agua en gris tenue
        cell.alignment = {
            vertical: 'middle',
            horizontal: colIndex === 2 ? 'center' : 'left'
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'dashed', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    // Filas 10 a 30: Filas en blanco con formato y bordes listos para escribir
    for (let rNum = 10; rNum <= 35; rNum++) {
        const row = worksheet.getRow(rNum);
        row.height = 22;
        const isEven = rNum % 2 === 0;
        const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        for (let colIndex = 1; colIndex <= 7; colIndex++) {
            const cell = row.getCell(colIndex);
            cell.value = '';
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bg }
            };
            cell.font = { size: 10, color: { argb: 'FF1E293B' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: colIndex === 3 ? 'center' : 'left'
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Validación desplegable para Tipo de Documento en columna C
            if (colIndex === 3) {
                cell.dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"CC,CE,TI,Pasaporte"']
                };
            }
        }
    }

    // ==========================================
    // HOJA 2: Guía y Ejemplos Detallados
    // ==========================================
    const guideSheet = workbook.addWorksheet('Guía y Ejemplos', {
        views: [{ showGridLines: true }]
    });

    guideSheet.columns = [
        { key: 'campo', width: 24 },
        { key: 'obligatorio', width: 16 },
        { key: 'valores', width: 36 },
        { key: 'descripcion', width: 50 }
    ];

    guideSheet.mergeCells('A1:D2');
    const guideHeader = guideSheet.getCell('A1');
    guideHeader.value = 'GUÍA OFICIAL DE DILIGENCIAMIENTO - IMPORTACIÓN MASIVA SIGAP';
    guideHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A2744' }
    };
    guideHeader.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    guideHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    const guideCols = ['Campo', 'Obligatorio', 'Valores Permitidos / Formato', 'Observaciones'];
    const guideColsRow = guideSheet.getRow(4);
    guideColsRow.height = 24;
    guideCols.forEach((text, i) => {
        const cell = guideColsRow.getCell(i + 1);
        cell.value = text;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF334155' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const guideRows = [
        ['Nombres', 'SÍ', 'Texto (ej. Juan Carlos)', 'Primer y segundo nombre del usuario.'],
        ['Apellidos', 'SÍ', 'Texto (ej. Pérez Gómez)', 'Primer y segundo apellido del usuario.'],
        ['Tipo Documento', 'SÍ', 'CC, CE, TI, Pasaporte', 'Tipo de documento de identificación oficial.'],
        ['Número Documento', 'SÍ', 'Numérico (ej. 1085123456)', 'Debe ser único en el sistema.'],
        ['Correo Institucional', 'SÍ', 'usuario@cesmag.edu.co', 'Correo válido institucional con dominio CESMAG.'],
        ['Roles', 'SÍ', 'Docente, Director, Consultor, Planeación', 'Puede ingresar uno o varios separados por coma.'],
        ['Programa Académico', 'Condicional', 'Ingeniería de Sistemas, Electrónica, Industrial, Financiera...', 'Requerido para Docente y Director. Si es solo Consultor o Planeación use "No aplica".']
    ];

    guideRows.forEach((r, idx) => {
        const row = guideSheet.getRow(5 + idx);
        row.height = 24;
        r.forEach((val, cIdx) => {
            const cell = row.getCell(cIdx + 1);
            cell.value = val;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' }
            };
            cell.font = { size: 9.5, color: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle', horizontal: cIdx === 1 ? 'center' : 'left', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    const outputPath = path.join(__dirname, '..', 'frontend', 'public', 'plantilla_docentes_SIGAP.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log('✅ Plantilla Excel generada exitosamente en:', outputPath);
}

generateTemplate().catch(console.error);
