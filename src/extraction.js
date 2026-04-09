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

populateSaleBtn.addEventListener('click', () => {
  if (!lastExtractedData) return;

  const saleModal = document.getElementById('saleModal');
  const buyerNameInput = document.getElementById('buyerName');
  const saleDateInput = document.getElementById('saleDate');
  const shippingSelect = document.getElementById('shipping');

  if (lastExtractedData.penerima) {
    buyerNameInput.value = lastExtractedData.penerima;
  }

  if (lastExtractedData.tanggal_dokumen) {
    saleDateInput.value = lastExtractedData.tanggal_dokumen;
  }

  if (lastExtractedData.shipping) {
    shippingSelect.value = lastExtractedData.shipping;
  }

  extractModal.classList.remove('show');
  saleModal.classList.add('show');
});
