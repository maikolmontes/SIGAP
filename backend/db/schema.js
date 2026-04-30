const pool = require('./connection');
pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('semana', 'actividad_semana', 'evidencias', 'resultados', 'indicadores', 'descripcion')
`).then(res => { 
    console.log(JSON.stringify(res.rows, null, 2)); 
    process.exit(0); 
}).catch(err => { 
    console.error(err); 
    process.exit(1); 
});
