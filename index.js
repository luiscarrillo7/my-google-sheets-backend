// my-google-sheets-backend/index.js

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();

const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, process.env.ENCODING_TYPE).toString('utf8')
);
const GOOGLE_SHEET_ID_DATOS = process.env.GOOGLE_SHEET_ID_DATOS;
const GOOGLE_SHEET_NAME_DATOS = process.env.GOOGLE_SHEET_NAME_DATOS || 'Hoja1';

const allowedOrigins = [
    'https://my-sheets-frontend.onrender.com',
    'http://localhost:5000',
    'http://localhost:3000',
    'https://capacitacion-dirisle.googlesites.cloud',
    'https://www.capacitacion-dirisle.googlesites.cloud',
    'https://prueba.googlesites.cloud',
    'https://prueba.googlesites.cloud'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

async function getAuthClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return await auth.getClient();
}

app.post('/api/check-user', async (req, res) => {
    const { valor } = req.body;

    console.log('Backend: Recibida solicitud para /api/check-user. Valor enviado:', valor);

    if (!valor) {
        console.log('Backend: Valor vacío. Devolviendo error 400.');
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // Rango de A a N
        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:N`, // Leeremos hasta la columna N
        });

        const rows = responseDatos.data.values;
        console.log('Backend: Datos leídos de la hoja de cálculo (incluyendo encabezados):', rows);

        if (rows && rows.length > 0) {
            const dataRows = rows.slice(1);

            const foundUser = dataRows.find(row => (row[1] || '').trim() === valor.trim());

            if (foundUser) {
                console.log('Backend: Usuario encontrado en la hoja de cálculo:', foundUser);

                const idUsuario = foundUser[1] || '';    // Columna B
                const nombre = foundUser[2] || '';       // Columna C
                const cargo = foundUser[3] || '';        // Columna D
                // Columna E (foundUser[4]) se ignora
                const eess = foundUser[5] || '';         // Columna F (Nombre de la EESS) - Renombrado de eessNombre a eess
                const ris = foundUser[6] || '';          // Columna G
                // Columnas H, I, J, K (foundUser[7] a foundUser[10]) se ignoran
                const horas = foundUser[12] || '';       // Columna M - ¡CAMBIO DE ÍNDICE Y DE DATO ESPERADO!
                const puntaje = foundUser[13] || '';     // Columna N - ¡CAMBIO DE ÍNDICE Y DE DATO ESPERADO!

                // Envío SOLO los campos deseados (B, C, D, F, G, M, N)
                return res.json({
                    exists: true,
                    message: 'Usuario existe.',
                    idUsuario,
                    nombre,
                    cargo,
                    eess,     // Ahora este es el nombre de la EESS de la Columna F
                    ris,
                    horas,    // Dato de Columna M
                    puntaje   // Dato de Columna N
                });
            }
        }

        console.log('Backend: Usuario no encontrado en la hoja de cálculo (después de buscar).');
        return res.json({ exists: false, message: 'Usuario no encontrado.' });

    } catch (error) {
        console.error('Backend: Error al acceder a Google Sheet:', error.message, error.stack);
        return res.status(500).json({ message: 'Error interno del servidor al verificar el usuario.' });
    }
});

app.get('/', (req, res) => {
    res.send('¡Backend funcionando! Usa el endpoint /api/check-user para verificar usuarios.');
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en http://0.0.0.0:${port}`);
});