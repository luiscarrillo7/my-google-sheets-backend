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

    // --- CÓDIGO AÑADIDO/MODIFICADO PARA CAPTURAR INFORMACIÓN DE LA SOLICITUD ---
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || 'N/A'; // De dónde vino la solicitud (URL del frontend)

    console.log('Backend: =========================================');
    console.log(`Backend: Nueva solicitud recibida.`);
    console.log(`Backend: IP del cliente: ${clientIp}`);
    console.log(`Backend: User-Agent (SO/Dispositivo): ${userAgent}`);
    console.log(`Backend: Referer (Origen de la solicitud): ${referer}`);
    console.log(`Backend: Valor enviado en el cuerpo de la solicitud: ${valor}`);
    console.log('Backend: =========================================');
    // --- FIN DEL CÓDIGO AÑADIDO/MODIFICADO ---

    if (!valor) {
        console.log('Backend: Valor vacío. Devolviendo error 400.');
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:N`,
        });

        const rows = responseDatos.data.values;
        // Mantenemos este log para ver los datos completos de la hoja
        console.log('Backend: Datos leídos de la hoja de cálculo (incluyendo encabezados):', rows);

        if (rows && rows.length > 0) {
            const dataRows = rows.slice(1);

            const foundUser = dataRows.find(row => (row[4] || '').trim() === valor.trim());

            if (foundUser) {
                // Mantenemos este log para ver el usuario encontrado
                console.log('Backend: Usuario encontrado en la hoja de cálculo:', foundUser);

                const idUsuario = foundUser[4] || '';
                const nombre = foundUser[2] || '';
                const cargo = foundUser[3] || '';
                const eess = foundUser[5] || '';
                const ris = foundUser[6] || '';
                const horas = foundUser[12] || '';
                const puntaje = foundUser[13] || '';

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