const fs = require('fs');
console.log('Exists?', fs.existsSync('image.png'));
console.log('Size:', fs.statSync('image.png').size);
