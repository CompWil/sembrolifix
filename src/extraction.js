import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const extractModal = document.getElementById('extractModal');
const extractDocBtn = document.getElementById('extractDocBtn');
const closeExtractModal = document.getElementById('closeExtractModal');
const cancelExtractBtn = document.getElementById('cancelExtractBtn');
const extractForm = document.getElementById('extractForm');
const documentImage = document.getElementById('documentImage');
const extractPreview = document.getElementById('extractPreview');
const extractResults = document.getElementById('extractResults');
const resultsJson = document.getElementById('resultsJson');
const populateSaleBtn = document.getElementById('populateSaleBtn');

let lastExtractedData = null;

extractDocBtn.addEventListener('click', () => {
  extractModal.classList.add('show');
  extractForm.reset();
  extractPreview.innerHTML = '';
  extractResults.style.display = 'none';
});

closeExtractModal.addEventListener('click', () => {
  extractModal.classList.remove('show');
  extractForm.reset();
  extractPreview.innerHTML = '';
  extractResults.style.display = 'none';
});

cancelExtractBtn.addEventListener('click', () => {
  extractModal.classList.remove('show');
  extractForm.reset();
  extractPreview.innerHTML = '';
  extractResults.style.display = 'none';
});

extractModal.addEventListener('click', (e) => {
  if (e.target === extractModal) {
    extractModal.classList.remove('show');
    extractForm.reset();
    extractPreview.innerHTML = '';
    extractResults.style.display = 'none';
  }
});

documentImage.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      extractPreview.innerHTML = '';

      if (file.type === 'application/pdf') {
        const preview = document.createElement('div');
        preview.style.padding = '1rem';
        preview.style.backgroundColor = '#f5f5f5';
        preview.style.borderRadius = '0.5rem';
        preview.style.textAlign = 'center';
        preview.textContent = `PDF file selected: ${file.name}`;
        extractPreview.appendChild(preview);
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const preview = document.createElement('div');
        preview.style.padding = '1rem';
        preview.style.backgroundColor = '#f5f5f5';
        preview.style.borderRadius = '0.5rem';
        preview.style.textAlign = 'center';
        preview.textContent = `CSV file selected: ${file.name}`;
        extractPreview.appendChild(preview);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                 file.type === 'application/vnd.ms-excel' ||
                 file.name.endsWith('.xlsx') ||
                 file.name.endsWith('.xls')) {
        const preview = document.createElement('div');
        preview.style.padding = '1rem';
        preview.style.backgroundColor = '#f5f5f5';
        preview.style.borderRadius = '0.5rem';
        preview.style.textAlign = 'center';
        preview.textContent = `Excel file selected: ${file.name}`;
        extractPreview.appendChild(preview);
      } else if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.borderRadius = '0.5rem';
        extractPreview.appendChild(img);
      }
    };
    reader.readAsDataURL(file);
  }
});

extractForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = documentImage.files?.[0];
  if (!file) {
    alert('Please select a document file (PDF or image)');
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target.result.split(',')[1];

      const apiUrl = `${supabaseUrl}/functions/v1/extract-document`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Image: base64String,
          fileType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const extractedData = await response.json();
      lastExtractedData = extractedData;

      resultsJson.textContent = JSON.stringify(extractedData, null, 2);
      extractResults.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error:', error);
    alert('Error extracting data from document');
  }
});

async function getOrCreateItem(productName) {
  if (!productName) {
    console.warn('Product name is empty');
    return null;
  }

  const trimmedName = String(productName).trim();
  console.log('Looking for item:', trimmedName);

  const { data: existingItem, error: searchError } = await supabase
    .from('items')
    .select('id')
    .eq('name', trimmedName)
    .maybeSingle();

  if (searchError) {
    console.error('Error searching for item:', searchError);
  }

  if (existingItem) {
    console.log('Found existing item:', existingItem.id);
    return existingItem.id;
  }

  console.log('Item not found, creating new item:', trimmedName);
  const { data: newItem, error } = await supabase
    .from('items')
    .insert([{ name: trimmedName }])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating item:', error);
    return null;
  }

  console.log('Item created:', newItem?.id);
  return newItem?.id || null;
}

async function insertExtractedSale(extractedData) {
  console.log('Attempting to insert extracted data:', extractedData);

  if (!extractedData.penerima || !extractedData.tanggal_dokumen) {
    console.warn('Missing required fields for sale insertion');
    console.warn('penerima:', extractedData.penerima);
    console.warn('tanggal_dokumen:', extractedData.tanggal_dokumen);
    return false;
  }

  try {
    // Ensure date is properly formatted
    let saleDate = extractedData.tanggal_dokumen;
    if (saleDate && typeof saleDate === 'string') {
      // Convert date format if needed (handle both YYYY-MM-DD and DD/MM/YYYY)
      if (saleDate.includes('/')) {
        const parts = saleDate.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          saleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }

    console.log('Inserting sale with buyer_name:', extractedData.penerima, 'and date:', saleDate);

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([
        {
          buyer_name: extractedData.penerima,
          sale_date: saleDate,
          shipping: extractedData.shipping || 'SPX',
        },
      ])
      .select()
      .maybeSingle();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return false;
    }

    if (!saleData) {
      console.warn('No sale data returned from insert');
      return false;
    }

    console.log('Sale created successfully:', saleData.id);

    if (extractedData.nama_produk && extractedData.qty) {
      console.log('Processing item:', extractedData.nama_produk, 'qty:', extractedData.qty);
      const itemId = await getOrCreateItem(extractedData.nama_produk);

      if (itemId) {
        console.log('Item ID:', itemId, 'inserting into sale_items');
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert([
            {
              sale_id: saleData.id,
              item_id: itemId,
              quantity: parseInt(extractedData.qty) || 1,
            },
          ]);

        if (itemError) {
          console.error('Error adding sale item:', itemError);
          return false;
        }
        console.log('Sale item added successfully');
      } else {
        console.warn('Could not create or find item:', extractedData.nama_produk);
      }
    } else {
      console.warn('Missing product info - nama_produk:', extractedData.nama_produk, 'qty:', extractedData.qty);
    }

    return true;
  } catch (error) {
    console.error('Error in insertExtractedSale:', error);
    return false;
  }
}

populateSaleBtn.addEventListener('click', async () => {
  if (!lastExtractedData) return;

  populateSaleBtn.disabled = true;
  populateSaleBtn.textContent = 'Inserting...';

  try {
    const inserted = await insertExtractedSale(lastExtractedData);

    if (inserted) {
      alert('Sale inserted into Recent Sales table successfully!');
      extractModal.classList.remove('show');
      extractForm.reset();
      extractPreview.innerHTML = '';
      extractResults.style.display = 'none';
      location.reload();
    } else {
      alert('Failed to insert sale. Check the console for details.');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error inserting sale');
  } finally {
    populateSaleBtn.disabled = false;
    populateSaleBtn.textContent = 'Auto-Insert to Recent Sales';
  }
});
