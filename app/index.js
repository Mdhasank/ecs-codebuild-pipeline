const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', {
        title: 'NEBULA | The Spatial Terminal'
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('HEALTHY');
});

app.listen(PORT, () => {
    console.log(`Nebula Landing Page running on http://localhost:${PORT}`);
});
