grist.ready({ 
  requiredAccess: 'full',
  columns: [
    {
      name: "col_html",
      title: "Colonne html",
      optional: false,
      type: "Text",
      description: "Colonne texte qui contient le html dynamique"
    },
    {
      name: "col_select",
      title: "Colonne de sélection",
      optional: false,
      type: "Bool",
      description: "Colonne booléen qui permet de sélectionner les lignes à imprimer/enregistrer."
    }
  ]
});

const output = document.querySelector("#output");
const printBtn = document.querySelector("#printBtn");
const namePattern = document.querySelector("#namePattern");
let mappedData = [];
let allDataRows = [];
let htmlColumnName = null;
let selectColumnName = null;

grist.onRecords(async (records) => {
  // Comme on a mappé des colonnes, records retourne uniquement
  // les colonnes mappées
  mappedData = records;
  console.log("mappedData:", mappedData);
  
  // Récupérer les noms des colonnes mappées
  if (records.length > 0) {
    const keys = Object.keys(records[0]).filter(key => key !== 'id');
    console.log("Colonnes mappées:", keys);
    
    keys.forEach(key => {
      const firstValue = records[0][key];
      if (typeof firstValue === 'boolean') {
        selectColumnName = key;
      } else if (typeof firstValue === 'string') {
        htmlColumnName = key;
      }
    });
    
    console.log("htmlColumnName:", htmlColumnName);
    console.log("selectColumnName:", selectColumnName);
  }
  
  // Récupérer toutes les colonnes de la table via l'API
  try {
    const table = await grist.getTable();
    const tableName = await table._platform.getTableId();
    console.log("tableName:", tableName);
    
    const allData = await grist.docApi.fetchTable(tableName);
    console.log("allData (structure):", allData);
    
    // Convertir allData en tableau d'objets
    allDataRows = [];
    const numRows = allData.id.length;
    const columnNames = Object.keys(allData);
    
    for (let i = 0; i < numRows; i++) {
      const row = {};
      columnNames.forEach(colName => {
        row[colName] = allData[colName][i];
      });
      allDataRows.push(row);
    }
    
    console.log("allDataRows (tableau d'objets):", allDataRows);
  } catch (error) {
    console.error("Erreur lors de la récupération des données complètes:", error);
  }
});

printBtn.addEventListener('click', async () => {
  if (mappedData.length === 0 || allDataRows.length === 0) {
    alert("Aucune donnée à télécharger");
    return;
  }

  if (!htmlColumnName || !selectColumnName) {
    alert("Les colonnes mappées n'ont pas été mappées");
    return;
  }

  // Filtrer les lignes où la colonne de sélection est true
  const rowsToDownload = [];
  mappedData.forEach((mappedRow) => {
    if (mappedRow[selectColumnName] === true) {
      // Trouver la ligne correspondante dans allDataRows par id
      const fullRow = allDataRows.find(row => row.id === mappedRow.id);
      if (fullRow) {
        rowsToDownload.push({
          mapped: mappedRow,
          original: fullRow
        });
      }
    }
  });
  
  console.log("rowsToDownload:", rowsToDownload);
  
  if (rowsToDownload.length === 0) {
    alert("Aucune ligne avec la colonne de sélection = True");
    return;
  }

  const pattern = namePattern.value.trim();
  
  // Fonction pour générer le nom du fichier
  function generateFileName(row, index) {
    console.log("generateFileName - row:", row);
    console.log("generateFileName - clés disponibles:", Object.keys(row));
    
    if (!pattern) {
      return `${index + 1}`;
    }
    
    const variables = pattern.match(/\{([^}]+)\}/g);
    
    if (!variables) {
      return `${pattern} - ${index + 1}`;
    }
    
    let fileName = pattern;
    for (let variable of variables) {
      const columnId = variable.slice(1, -1).trim();
      
      if (!(columnId in row)) {
        throw new Error(`La colonne "${columnId}" n'existe pas`);
      }
      
      const value = (row[columnId] || '').toString().trim();
      fileName = fileName.replace(variable, value);
    }
    
    fileName = fileName.replace(/\s+/g, ' ').trim();
    
    return fileName;
  }

  // Ouvrir les fenêtres d'impression
  try {
    for (let i = 0; i < rowsToDownload.length; i++) {
      const item = rowsToDownload[i];
      const fileName = generateFileName(item.original, i);
      
      const printWindow = window.open('', '_blank');
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${fileName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              margin: 0;
            }
            @media print {
              body {
                padding: 10mm;
              }
            }
          </style>
        </head>
        <body>
          ${item.mapped[htmlColumnName] || ''}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          <\/script>
        </body>
        </html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
    
  } catch (error) {
    console.error("Erreur:", error);
    alert(error.message);
  }
});
