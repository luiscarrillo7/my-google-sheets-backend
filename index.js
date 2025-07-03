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

    // Log para ver el valor recibido en el backend
    console.log('Backend: Recibida solicitud para /api/check-user. Valor enviado:', valor);

    if (!valor) {
        console.log('Backend: Valor vacío. Devolviendo error 400.');
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:M`,
        });

        const rows = responseDatos.data.values;
        // Log para ver todos los datos leídos de la hoja
        console.log('Backend: Datos leídos de la hoja de cálculo:', rows);

        if (rows && rows.length > 0) {
            const dataRows = rows.slice(1);

            const foundUser = dataRows.find(row => {
                // Log para cada comparación
                console.log(`Backend: Comparando '${row[0]}' (hoja) con '${valor}' (recibido)`);
                return row[0] === valor;
            });

            if (foundUser) {
                console.log('Backend: Usuario encontrado en la hoja de cálculo.');
                const idUsuario = foundUser[0] || '';
                const nombre = foundUser[1] || '';
                const cargo = foundUser[2] || '';
                const eess = foundUser[4] || '';
                const ris = foundUser[5] || '';
                const horas = foundUser[11] || '';
                const puntaje = foundUser[12] || '';

                return res.json({
                    exists: true,
                    message: 'Usuario existe.',
                    idUsuario,
                    nombre,
                    cargo,
                    eess,
                    ris,
                    horas,
                    puntaje
                });
            }
        }

        console.log('Backend: Usuario no encontrado en la hoja de cálculo.');
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