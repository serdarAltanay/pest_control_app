const fs = require('fs');
const files = ['src/pages/ek1/Ek1Preview.scss', 'src/styles/SignatureModal.scss'];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');

    // Replace print block
    const printRegex = /@media print\s*\{[\s\S]*?print-color-adjust:\s*exact;\s*\}\s*\}/;
    const newPrintBlock = `@media print {
    padding: 0;
    margin: 0;
    min-height: auto;
    background: transparent;

    @page { margin: 0; }
    .no-print { display: none !important; }

    .page.A4 {
      margin: 0;
      box-shadow: none;
      width: 100%;
      max-width: 100%;
      min-height: auto;
      padding: 5mm;
      border: none;
      page-break-after: avoid;
      page-break-inside: avoid;
    }

    * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }`;

    content = content.replace(printRegex, newPrintBlock);

    if (f.includes('SignatureModal')) {
        content = content.replace(/min-height:\s*250px\s*!important;/, 'min-height: 55vh !important;');
    }

    fs.writeFileSync(f, content, 'utf8');
});
console.log('Fixed');
