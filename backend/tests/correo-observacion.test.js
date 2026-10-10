// Correo al docente cuando el director deja una observación en su avance (utils/emailTemplates.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const plantillas = require('../utils/emailTemplates');

const datos = {
    docente: 'Ana Pérez',
    director: 'Luis Gómez',
    periodo: '2026-II',
    corte: 'Semana 8',
    actividad: 'Gestión Curricular',
    observacion: 'Falta adjuntar el acta.',
    enlace: 'http://localhost:5173/docente/avance-semana-8',
};

test('el asunto dice que es una observación y en qué corte', () => {
    const { subject } = plantillas.plantillaObservacionDirector(datos);
    assert.match(subject, /observación/i);
    assert.match(subject, /Semana 8/);
});

test('el correo trae al docente, quién escribió, la actividad, el corte, la observación y el enlace al reporte', () => {
    const { html } = plantillas.plantillaObservacionDirector(datos);
    for (const texto of ['Ana Pérez', 'Luis Gómez', '2026-II', 'Semana 8', 'Gestión Curricular', 'Falta adjuntar el acta.']) {
        assert.ok(html.includes(texto), `debe incluir "${texto}"`);
    }
    assert.ok(html.includes('href="http://localhost:5173/docente/avance-semana-8"'));
});

test('el texto de la observación no puede inyectar HTML en el correo', () => {
    const { html } = plantillas.plantillaObservacionDirector({ ...datos, observacion: '<script>alert(1)</script>\nSegunda línea' });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('<br>'), 'los saltos de línea se conservan');
});

test('en un intersemestral el corte llega como "Semana X"', () => {
    const { subject, html } = plantillas.plantillaObservacionDirector({ ...datos, corte: 'Semana X' });
    assert.match(subject, /Semana X/);
    assert.ok(html.includes('Semana X'));
});
