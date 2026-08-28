const fs = require('fs');

const data = fs.readFileSync('/home/jeisson/Descargas/agenda11 (1).sql', 'binary');
// Simple extraction of COPY blocks
const lines = data.split('\n');
let out = '';
let inCopy = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find lines that start with COPY (allowing non-printable chars before)
    if (line.match(/COPY public\.\w+ \(/)) {
        inCopy = true;
        out += line.replace(/^.*?(COPY public\.)/, '$1') + '\n';
        continue;
    }
    if (inCopy) {
        if (line.trim() === '\\.') {
            inCopy = false;
            out += '\\.\n\n';
        } else {
            // Check if it's a valid data line (tab separated)
            // It might contain binary garbage at the start of the line because of custom format blocks
            let cleanLine = line.replace(/^[^\t]+\t/, (m) => m.replace(/^.*?([\w\d]+)\t/, '$1\t'));
            out += line + '\n';
        }
    }
}

fs.writeFileSync('/home/jeisson/Documentos/SIGAP/restore.sql', out, 'utf8');
console.log('Extracted lines:', out.split('\n').length);
