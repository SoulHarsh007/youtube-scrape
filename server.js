const express = require('express');
const scraper = require('./scraper');
const ytpl = require('ytpl');
const app = express();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/api/search', (req, res) => {
  scraper
    .youtube(req.query.q, req.query.page)
    .then(x => res.json(x))
    .catch(e => res.send(e));
});
app.get('/api/playlist', (req, res) => {
  ytpl(req.query.q)
    .then(x => res.json(x))
    .catch(e => res.send(e));
});
app.listen(process.env.PORT || 8080, function () {
  console.log('Listening on port 8080');
});

module.exports = app;
