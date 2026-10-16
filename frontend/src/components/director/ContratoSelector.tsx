import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Pencil } from 'lucide-react';
import api from '../../services/api';
import { confirmar } from '../common/dialogo';

export interface TipoContrato {
    id_contrato: number;
    tipo: string;
    horas_contrato: number;
    /** Hora Cátedra: el Director fija las horas (de 0 al máximo) */
    horas_libres: boolean;
}

interface Props {
    idUsuario: number;
    nombre: string;
    idContrato: number;
    tipoContrato: string;
    horasContrato: number;
    totalHoras: number;
    /** El docente todavía no tiene la agenda liberada */
    editable: boolean;
    /** Solo el Director de programa corrige contratos */
    puedeCambiar: boolean;
    contratos: TipoContrato[];
    horasMaximas: number;
    periodo: string;
    onCambiado: (mensaje: string) => void;
    onError: (mensaje: string) => void;
}

const formatoHoras = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** Lo que se lee en la lista: "Medio Tiempo · 20 h", "Hora Cátedra · 12,5 h". */
const etiquetaOpcion = (c: TipoContrato, horasMaximas: number) =>
    c.horas_libres ? `${c.tipo} · de 0 a ${horasMaximas} h` : c.horas_contrato > 0 ? `${c.tipo} · ${formatoHoras(c.horas_contrato)} h` : `${c.tipo} · sin horas`;

/**
 * Tipo de contrato del docente EN EL PERÍODO ACTIVO. El Director lo corrige con una lista desplegable mientras la
 * agenda siga sin liberar; después queda como texto con candado. Para Hora Cátedra pide las horas (0 a 40).
 */
export default function ContratoSelector({
    idUsuario, nombre, idContrato, tipoContrato, horasContrato, totalHoras, editable, puedeCambiar,
    contratos, horasMaximas, periodo, onCambiado, onError,
}: Props) {
    const [guardando, setGuardando] = useState(false);
    const [dialogoHoras, setDialogoHoras] = useState<TipoContrato | null>(null);
    const [horasTexto, setHorasTexto] = useState('');
    const [errorHoras, setErrorHoras] = useState('');

    const actual = contratos.find(c => c.id_contrato === idContrato);
    const textoActual = actual?.horas_libres ? `${tipoContrato} · ${formatoHoras(horasContrato)} h` : tipoContrato;

    // Solo lectura: no es Director, o la agenda ya está en manos del docente
    if (!puedeCambiar || !editable || contratos.length === 0) {
        return (
            <span
                className="inline-flex items-center gap-1 text-xs text-gray-600 min-w-0"
                title={puedeCambiar && !editable ? 'La agenda ya fue liberada: el contrato del período ya no se puede cambiar.' : undefined}
            >
                <span className="truncate">{textoActual}</span>
                {puedeCambiar && !editable && <Lock className="w-3 h-3 text-gray-400 shrink-0" aria-label="Contrato bloqueado" />}
            </span>
        );
    }

    const enviar = async (tipo: TipoContrato, horas?: number) => {
        setGuardando(true);
        try {
            const res = await api.put(`/director/asignaciones/${idUsuario}/contrato`, {
                id_contrato: tipo.id_contrato,
                ...(tipo.horas_libres ? { horas_contrato: horas } : {}),
            });
            setDialogoHoras(null);
            onCambiado(res.data.sin_cambio
                ? res.data.mensaje
                : `Contrato de ${nombre}: ${res.data.tipo_contrato}${res.data.horas_contrato > 0 ? ` (${formatoHoras(res.data.horas_contrato)} h)` : ''}. Lleva ${formatoHoras(res.data.total_horas)} h asignadas.`);
        } catch (err: unknown) {
            const mensaje = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo cambiar el contrato.';
            if (tipo.horas_libres) setErrorHoras(mensaje); else onError(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    const abrirHoras = (tipo: TipoContrato) => {
        setHorasTexto(tipo.id_contrato === idContrato ? formatoHoras(horasContrato) : '');
        setErrorHoras('');
        setDialogoHoras(tipo);
    };

    const elegir = async (idNuevo: number) => {
        const tipo = contratos.find(c => c.id_contrato === idNuevo);
        if (!tipo || tipo.id_contrato === idContrato) return;
        if (tipo.horas_libres) { abrirHoras(tipo); return; }
        const confirmado = await confirmar({
            tipo: 'pregunta',
            titulo: '¿Cambiar el contrato?',
            mensaje: `¿Cambiar el contrato de ${nombre} a ${etiquetaOpcion(tipo, horasMaximas)} en el período ${periodo}?\n\nSolo cambia este período: su contrato en otros períodos no se toca. Planeación recibirá un aviso.`,
            textoAceptar: 'Cambiar contrato',
        });
        if (confirmado) await enviar(tipo);
    };

    const guardarHoras = () => {
        if (!dialogoHoras) return;
        const horas = Number(horasTexto.replace(',', '.'));
        if (horasTexto.trim() === '' || !Number.isFinite(horas)) { setErrorHoras('Escribe las horas contratadas.'); return; }
        if (horas < 0 || horas > horasMaximas) { setErrorHoras(`Las horas van de 0 a ${horasMaximas}.`); return; }
        if (Math.abs(horas / 0.5 - Math.round(horas / 0.5)) > 1e-9) { setErrorHoras('Las horas se registran de media en media hora (por ejemplo 12 o 12,5).'); return; }
        setErrorHoras('');
        void enviar(dialogoHoras, horas);
    };

    return (
        // Dentro de una fila que se abre al hacer clic: lo que ocurra aquí no debe abrirla ni cerrarla
        <span className="inline-flex items-center gap-1 min-w-0 max-w-full" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <select
                value={idContrato}
                onChange={e => void elegir(Number(e.target.value))}
                disabled={guardando}
                aria-label={`Tipo de contrato de ${nombre}`}
                title="Corregir el contrato de este docente en el período (antes de liberar su agenda)"
                className="text-xs text-gray-700 bg-white border border-gray-200 rounded-md px-1.5 py-1 w-full min-w-0 max-w-[12rem] truncate cursor-pointer hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            >
                {contratos.map(c => (
                    <option key={c.id_contrato} value={c.id_contrato}>
                        {c.id_contrato === idContrato && c.horas_libres ? `${c.tipo} · ${formatoHoras(horasContrato)} h` : etiquetaOpcion(c, horasMaximas)}
                    </option>
                ))}
            </select>
            {actual?.horas_libres && (
                <button
                    type="button"
                    onClick={() => abrirHoras(actual)}
                    className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                    title="Cambiar las horas contratadas"
                    aria-label={`Cambiar las horas contratadas de ${nombre}`}
                >
                    <Pencil className="w-3 h-3" />
                </button>
            )}

            {dialogoHoras && createPortal(
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-horas-catedra"
                    onClick={e => { e.stopPropagation(); if (!guardando) setDialogoHoras(null); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h2 id="titulo-horas-catedra" className="text-lg font-bold text-[#1a2744]">Horas contratadas · {dialogoHoras.tipo}</h2>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                            ¿Cuántas horas tiene contratadas <strong>{nombre}</strong> en el período {periodo}? De 0 a {horasMaximas}, de media en media hora.
                            Con 0 no se compara con la carga. Hoy tiene <strong>{formatoHoras(totalHoras)} h</strong> asignadas.
                        </p>
                        <label htmlFor="horas-catedra" className="block text-xs font-semibold text-gray-600 mt-4 mb-1">Horas contratadas</label>
                        <input
                            id="horas-catedra"
                            type="text"
                            inputMode="decimal"
                            placeholder="Por ejemplo 12 o 12,5"
                            autoComplete="off"
                            autoFocus
                            value={horasTexto}
                            onChange={e => { setHorasTexto(e.target.value); setErrorHoras(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') guardarHoras(); if (e.key === 'Escape' && !guardando) setDialogoHoras(null); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                        {errorHoras && <p role="alert" className="text-xs text-red-600 mt-2">{errorHoras}</p>}
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setDialogoHoras(null)}
                                disabled={guardando}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={guardarHoras}
                                disabled={guardando}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1a2744] hover:bg-[#24365f] disabled:opacity-60 cursor-pointer"
                            >
                                {guardando ? 'Guardando…' : 'Guardar contrato'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
}
