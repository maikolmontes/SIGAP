import { useEffect, useState } from 'react'
import api from '../services/api'

// Semestre (1, 2, 3 = Intersemestral I, 4 = Intersemestral II) del período activo. Sirve para rotular
// los cortes: en un intersemestral se muestran "Semana X" en vez de "Semana 8/16".
// Se consulta una sola vez y se comparte entre pantallas (se renueva cada 30 s).

const VIGENCIA_MS = 30_000
let cache: { semestre: number | null; hasta: number } | null = null
let enCurso: Promise<number | null> | null = null

const consultar = (): Promise<number | null> => {
    if (cache && cache.hasta > Date.now()) return Promise.resolve(cache.semestre)
    if (!enCurso) {
        enCurso = api.get('/periodos/activo')
            .then(res => {
                const semestre = res.data && res.data.semestre != null ? Number(res.data.semestre) : null
                cache = { semestre, hasta: Date.now() + VIGENCIA_MS }
                return semestre
            })
            .catch(() => null)
            .finally(() => { enCurso = null })
    }
    return enCurso
}

export default function useSemestreActivo(): number | null {
    const [semestre, setSemestre] = useState<number | null>(cache ? cache.semestre : null)
    useEffect(() => {
        let vigente = true
        consultar().then(s => { if (vigente) setSemestre(s) })
        return () => { vigente = false }
    }, [])
    return semestre
}
