import { Building2, GraduationCap } from 'lucide-react';
import type { FacultadAmbito, FiltroAmbito } from '../../services/analiticaService';

interface Props {
  facultades: FacultadAmbito[];
  filtro: FiltroAmbito;
  bloqueado: boolean;
  onCambiar: (filtro: FiltroAmbito) => void;
}

/**
 * Dos selectores encadenados: facultad y, dentro de ella, programa.
 * "Todas las facultades" y "Todos los programas" son opciones reales,
 * no marcadores: el backend agrega al nivel que corresponda.
 */
export default function FiltroAmbitoSelector({ facultades, filtro, bloqueado, onCambiar }: Props) {
  // Con el rol Director el alcance viene impuesto: no hay nada que elegir.
  if (bloqueado) return null;

  const facultadActual = facultades.find((f) => f.id_facultad === filtro.facultadId);
  const programas = facultadActual
    ? facultadActual.programas
    : facultades.flatMap((f) => f.programas);

  const cambiarFacultad = (valor: string) => {
    // Al cambiar de facultad se descarta el programa: podría no pertenecerle
    onCambiar(valor ? { facultadId: Number(valor) } : {});
  };

  const cambiarPrograma = (valor: string) => {
    onCambiar(valor
      ? { facultadId: filtro.facultadId, programaId: Number(valor) }
      : { facultadId: filtro.facultadId });
  };

  const claseSelect =
    'pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-white/20 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00a896]/40 cursor-pointer appearance-none max-w-[15rem] truncate';

  return (
    <>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
        <select
          value={filtro.facultadId ?? ''}
          onChange={(e) => cambiarFacultad(e.target.value)}
          className={claseSelect}
          title="Filtrar por facultad"
        >
          <option value="">Todas las facultades</option>
          {facultades.map((f) => (
            <option key={f.id_facultad ?? 'sin'} value={f.id_facultad ?? ''}>
              {f.nombre_facultad}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
        <select
          value={filtro.programaId ?? ''}
          onChange={(e) => cambiarPrograma(e.target.value)}
          className={claseSelect}
          title="Filtrar por programa académico"
        >
          <option value="">
            {facultadActual ? 'Todos los programas de la facultad' : 'Todos los programas'}
          </option>
          {programas.map((p) => (
            <option key={p.id_programa} value={p.id_programa}>
              {p.nombre_programa}
              {p.docentesConAgenda !== null ? ` (${p.docentesConAgenda})` : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
