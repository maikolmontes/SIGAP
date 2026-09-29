import { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import PanelSemana from '../../components/director/PanelSemana';

type TabId = '8' | '16';

const leerRolActivo = () => {
    try {
        const stored = localStorage.getItem('sigap_active_role');
        if (stored) {
            const p = JSON.parse(stored);
            return { nombre: p.nombre_rol || 'Revisión', funciones: (p.funciones_revisa || []) as string[] };
        }
    } catch { /* sin rol guardado */ }
    return { nombre: 'Revisión', funciones: [] as string[] };
};

/**
 * Avances por revisar — bandeja del revisor de una función sustantiva.
 *
 * Cada corte se revisa por separado: lo aprobado en la semana 8 no cuenta
 * para la 16. Van como pestañas dentro de una sola entrada de menú, igual
 * que las del Director.
 */
export default function AvancesRevision() {
    const { semana: semanaParam } = useParams<{ semana: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { funciones } = useMemo(leerRolActivo, []);

    // Al volver desde el detalle de un docente se reabre la pestaña de origen
    const tabInicial = ((location.state as any)?.tab || semanaParam) as TabId | undefined;
    const [tab, setTab] = useState<TabId>(tabInicial === '16' ? '16' : '8');

    const abrir = (t: TabId) => {
        setTab(t);
        navigate(`/revision/semanas/${t}`, { replace: true });
    };

    return (
        <Layout rol="revision" path={`Supervisión / Semana ${tab}`}>
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Avances por Revisar</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Avances de <strong>{funciones.join(' / ') || 'tu función'}</strong> reportados en el corte.
                    Cuando lo marques como <strong>revisado</strong>, esa función pasa al Director.
                </p>
            </div>

            {/* ── Navegación de Tabs ── */}
            <div className="flex flex-wrap gap-3 mb-6">
                {(['8', '16'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => abrir(t)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === t
                            ? 'bg-[#1a2744] text-white shadow-md'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                    >
                        Agenda Semana {t}
                    </button>
                ))}
            </div>

            {/* key fuerza recargar los datos al cambiar de corte */}
            <PanelSemana key={tab} semana={tab} modulo="revision" />
        </Layout>
    );
}
