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
    'http://localhost:3000'
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

    if (!valor) {
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // **** CAMBIO CLAVE AQUÍ: Rango de A a M ****
        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:M`, // Ahora leeremos hasta la columna M
        });

        const rows = responseDatos.data.values;

        if (rows && rows.length > 0) { // Asegúrate de que haya filas y que no sea solo el encabezado
            // Opcional: Saltar la fila de encabezado si siempre está presente y no quieres buscar ahí
            const dataRows = rows.slice(1); // Si la fila 1 es siempre el encabezado, empieza desde la fila 2

            const foundUser = dataRows.find(row => row[0] === valor); // Busca en columna A (índice 0)

            if (foundUser) {
                // **** EXTRACCIÓN DE DATOS DE LAS NUEVAS COLUMNAS ****
                // Asegúrate de que cada campo exista antes de intentar acceder a él, o proporciona un valor por defecto
                const idUsuario = foundUser[0] || ''; // Columna A
                const nombre = foundUser[1] || ''; // Columna B (que es el "NOMBRE" según tu imagen)
                const cargo = foundUser[2] || ''; // Columna C
                // foundUser[3] sería Columna D (Unnamed) - la omitimos
                const eess = foundUser[4] || ''; // Columna E
                const ris = foundUser[5] || ''; // Columna F
                // foundUser[6] hasta foundUser[10] serían columnas G, H, I, J, K - las omitimos
                const horas = foundUser[11] || ''; // Columna L
                const puntaje = foundUser[12] || ''; // Columna M

                // **** CAMBIO AQUÍ: Envío de todos los nuevos campos ****
                return res.json({
                    exists: true,
                    message: 'Usuario existe.',
                    idUsuario, // Este es el valor buscado
                    nombre,    // Columna B
                    cargo,     // Columna C
                    eess,      // Columna E
                    ris,       // Columna F
                    horas,     // Columna L
                    puntaje    // Columna M
                });
            }
        }

        return res.json({ exists: false, message: 'Usuario no encontrado.' });

    } catch (error) {
        console.error('Error al acceder a Google Sheet:', error.message, error.stack);
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