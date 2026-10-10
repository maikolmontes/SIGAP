// Almacén de los archivos de evidencias: Vercel Blob privado en producción, carpeta local en desarrollo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const almacen = require('../services/almacenEvidencias');

const leer = async (stream) => {
    const trozos = [];
    for await (const t of stream) trozos.push(Buffer.from(t));
    return Buffer.concat(trozos).toString('utf8');
};

// Entorno controlado: cada prueba decide si hay token de Blob y si "está en Vercel"
const ENTORNO = ['BLOB_READ_WRITE_TOKEN', 'VERCEL'];
const respaldo = Object.fromEntries(ENTORNO.map((k) => [k, process.env[k]]));
const entorno = ({ token = false, vercel = false } = {}) => {
    if (token) process.env.BLOB_READ_WRITE_TOKEN = 'token-de-prueba'; else delete process.env.BLOB_READ_WRITE_TOKEN;
    if (vercel) process.env.VERCEL = '1'; else delete process.env.VERCEL;
};
test.afterEach(() => {
    for (const k of ENTORNO) { if (respaldo[k] === undefined) delete process.env[k]; else process.env[k] = respaldo[k]; }
    almacen._pruebas.fijarBlob(null);
    almacen._pruebas.fijarCarpeta(null);
});

const carpetaTemporal = () => {
    const c = fs.mkdtempSync(path.join(os.tmpdir(), 'sigap-evid-'));
    almacen._pruebas.fijarCarpeta(c);
    return c;
};

// Blob falso en memoria con la misma forma que @vercel/blob
const blobFalso = () => {
    const guardado = new Map();
    const llamadas = { put: [], get: [], del: [] };
    class BlobNotFoundError extends Error { constructor() { super('no existe'); this.name = 'BlobNotFoundError'; } }
    return {
        guardado, llamadas,
        put: async (clave, cuerpo, opciones) => { llamadas.put.push({ clave, opciones }); guardado.set(clave, { cuerpo: Buffer.from(cuerpo), tipo: opciones.contentType }); return { pathname: clave }; },
        get: async (clave, opciones) => {
            llamadas.get.push({ clave, opciones });
            const g = guardado.get(clave);
            if (!g) return null;
            return { statusCode: 200, stream: new Response(g.cuerpo).body, blob: { contentType: g.tipo, size: g.cuerpo.length } };
        },
        del: async (clave) => { llamadas.del.push(clave); if (!guardado.delete(clave)) throw new BlobNotFoundError(); },
    };
};

test('el modo depende de si hay token de Blob y de si el servidor es Vercel', () => {
    entorno({ token: false, vercel: false });
    assert.equal(almacen.modo(), 'disco');
    entorno({ token: true, vercel: true });
    assert.equal(almacen.modo(), 'blob');
    entorno({ token: false, vercel: true });
    assert.equal(almacen.modo(), 'no_configurado', 'en Vercel sin token no se puede guardar');
});

test('en Vercel sin token se avisa con un error claro y no se intenta escribir en el disco', async () => {
    entorno({ token: false, vercel: true });
    const c = carpetaTemporal();
    await assert.rejects(almacen.guardar({ buffer: Buffer.from('hola'), nombre: 'a.pdf', tipo: 'application/pdf' }), almacen.AlmacenNoConfigurado);
    assert.deepEqual(fs.readdirSync(c), [], 'no escribió nada');
});

test('desarrollo local: guarda en la carpeta, lo abre, y lo borra', async () => {
    entorno();
    const c = carpetaTemporal();
    await almacen.guardar({ buffer: Buffer.from('contenido de prueba'), nombre: 'evidencia-1.pdf', tipo: 'application/pdf' });
    assert.ok(fs.existsSync(path.join(c, 'evidencia-1.pdf')));

    const abierto = await almacen.abrir('evidencia-1.pdf');
    assert.equal(await leer(abierto.stream), 'contenido de prueba');
    assert.equal(abierto.tamano, 'contenido de prueba'.length);

    await almacen.eliminar('evidencia-1.pdf');
    assert.equal(await almacen.abrir('evidencia-1.pdf'), null);
    await almacen.eliminar('evidencia-1.pdf'); // borrar lo que ya no está no falla
});

test('no se sobrescribe un archivo existente', async () => {
    entorno();
    carpetaTemporal();
    await almacen.guardar({ buffer: Buffer.from('uno'), nombre: 'x.pdf' });
    await assert.rejects(almacen.guardar({ buffer: Buffer.from('dos'), nombre: 'x.pdf' }));
    assert.equal(await leer((await almacen.abrir('x.pdf')).stream), 'uno');
});

test('producción: guarda en Blob PRIVADO, con el tipo, sin sufijo aleatorio ni sobrescritura, y no toca el disco', async () => {
    entorno({ token: true, vercel: true });
    const c = carpetaTemporal();
    const b = blobFalso();
    almacen._pruebas.fijarBlob(b);

    await almacen.guardar({ buffer: Buffer.from('informe'), nombre: 'evidencia-9.pdf', tipo: 'application/pdf' });
    assert.equal(b.llamadas.put.length, 1);
    assert.equal(b.llamadas.put[0].clave, 'evidencias/evidencia-9.pdf');
    assert.deepEqual(b.llamadas.put[0].opciones, { access: 'private', contentType: 'application/pdf', addRandomSuffix: false, allowOverwrite: false });
    assert.deepEqual(fs.readdirSync(c), []);
});

test('producción: abre el archivo desde Blob con acceso privado y devuelve tipo y tamaño', async () => {
    entorno({ token: true, vercel: true });
    carpetaTemporal();
    const b = blobFalso();
    almacen._pruebas.fijarBlob(b);
    await almacen.guardar({ buffer: Buffer.from('informe final'), nombre: 'evidencia-9.pdf', tipo: 'application/pdf' });

    const abierto = await almacen.abrir('evidencia-9.pdf');
    assert.equal(await leer(abierto.stream), 'informe final');
    assert.equal(abierto.tipo, 'application/pdf');
    assert.equal(abierto.tamano, 13);
    assert.equal(b.llamadas.get[0].opciones.access, 'private');
});

test('producción: un archivo que no está en Blob (ni en disco) da null, no un error', async () => {
    entorno({ token: true, vercel: true });
    carpetaTemporal();
    almacen._pruebas.fijarBlob(blobFalso());
    assert.equal(await almacen.abrir('no-existe.pdf'), null);
});

test('producción: borrar quita el archivo de Blob y no falla si ya no estaba', async () => {
    entorno({ token: true, vercel: true });
    carpetaTemporal();
    const b = blobFalso();
    almacen._pruebas.fijarBlob(b);
    await almacen.guardar({ buffer: Buffer.from('x'), nombre: 'e.pdf' });
    await almacen.eliminar('e.pdf');
    assert.equal(b.guardado.size, 0);
    await almacen.eliminar('e.pdf'); // ya no existe: sin error
    assert.deepEqual(b.llamadas.del, ['evidencias/e.pdf', 'evidencias/e.pdf']);
});

test('un error real de Blob al leer no se oculta como "archivo no encontrado"', async () => {
    entorno({ token: true, vercel: true });
    carpetaTemporal();
    almacen._pruebas.fijarBlob({ get: async () => { throw new Error('servicio caído'); } });
    await assert.rejects(almacen.abrir('e.pdf'), /servicio caído/);
});

test('los nombres con ../ no pueden salirse de la carpeta de evidencias', async () => {
    entorno({ token: true, vercel: true });
    const c = carpetaTemporal();
    const b = blobFalso();
    almacen._pruebas.fijarBlob(b);
    await almacen.guardar({ buffer: Buffer.from('x'), nombre: '../../etc/passwd' });
    assert.equal(b.llamadas.put[0].clave, 'evidencias/passwd');

    entorno();
    await almacen.guardar({ buffer: Buffer.from('y'), nombre: '../../fuera.txt' });
    assert.deepEqual(fs.readdirSync(c), ['fuera.txt']);
    assert.ok(!fs.existsSync(path.join(c, '..', '..', 'fuera.txt')));
});
