import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let items = [];
let sales = [];
let chart = null;
let itemRowCount = 0;

const modal = document.getElementById('saleModal');
const addSaleBtn = document.getElementById('addSaleBtn');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const saleForm = document.getElementById('saleForm');
const salesTableBody = document.getElementById('salesTableBody');
const itemsContainer = document.getElementById('itemsContainer');
const addItemBtn = document.getElementById('addItemBtn');
const saleDateInput = document.getElementById('saleDate');

saleDateInput.valueAsDate = new Date();

function openModal() {
  modal.classList.add('show');
  saleForm.reset();
  saleDateInput.valueAsDate = new Date();
  itemRowCount = 0;
  itemsContainer.innerHTML = '';
  addItemRow();
}

function closeModal() {
  modal.classList.remove('show');
  saleForm.reset();
}

addSaleBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
addItemBtn.addEventListener('click', (e) => {
  e.preventDefault();
  addItemRow();
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

function addItemRow() {
  const rowId = itemRowCount++;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = `item-row-${rowId}`;

  row.innerHTML = `
    <div>
      <label>Item</label>
      <select class="item-select" data-row="${rowId}" required>
        <option value="">Select an item...</option>
        ${items.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}
      </select>
    </div>
    <div>
      <label>Qty</label>
      <input type="number" class="item-quantity" data-row="${rowId}" min="1" value="1" required>
    </div>
    <button type="button" class="btn-remove" onclick="removeItemRow(${rowId})">Remove</button>
  `;

  itemsContainer.appendChild(row);
}

window.removeItemRow = (rowId) => {
  const row = document.getElementById(`item-row-${rowId}`);
  if (row) {
    row.remove();
  }
};

async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading items:', error);
    return;
  }

  items = data || [];
}

async function loadSales() {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sale_items (
        quantity,
        items (
          name
        )
      )
    `)
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('Error loading sales:', error);
    salesTableBody.innerHTML = '<tr><td colspan="4" class="loading">Error loading sales</td></tr>';
    return;
  }

  sales = data || [];
  displaySales();
  updateChart();
}

function displaySales() {
  if (sales.length === 0) {
    salesTableBody.innerHTML = '<tr><td colspan="4" class="loading">No sales recorded yet</td></tr>';
    return;
  }

  salesTableBody.innerHTML = sales.map(sale => {
    const itemsList = sale.sale_items
      .map(si => `${si.items.name} (${si.quantity})`)
      .join(', ');

    return `
      <tr>
        <td>${formatDate(sale.sale_date)}</td>
        <td>${sale.buyer_name}</td>
        <td>${itemsList}</td>
        <td>
          <button class="btn-danger" onclick="deleteSale('${sale.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

saleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const buyerName = document.getElementById('buyerName').value;
  const saleDate = document.getElementById('saleDate').value;

  const itemRows = Array.from(itemsContainer.querySelectorAll('.item-row'));
  const saleItems = itemRows.map(row => {
    const select = row.querySelector('.item-select');
    const quantity = row.querySelector('.item-quantity');
    return {
      item_id: select.value,
      quantity: parseInt(quantity.value)
    };
  }).filter(item => item.item_id);

  if (saleItems.length === 0) {
    alert('Please add at least one item to the sale.');
    return;
  }

  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert([
      {
        buyer_name: buyerName,
        sale_date: saleDate
      }
    ])
    .select();

  if (saleError) {
    console.error('Error adding sale:', saleError);
    alert('Error adding sale. Please try again.');
    return;
  }

  const saleId = saleData[0].id;

  const saleItemsData = saleItems.map(item => ({
    sale_id: saleId,
    item_id: item.item_id,
    quantity: item.quantity
  }));

  const { error: itemError } = await supabase
    .from('sale_items')
    .insert(saleItemsData);

  if (itemError) {
    console.error('Error adding sale items:', itemError);
    alert('Error adding items to sale. Please try again.');
    return;
  }

  closeModal();
  await loadSales();
});

window.deleteSale = async (id) => {
  if (!confirm('Are you sure you want to delete this sale?')) {
    return;
  }

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting sale:', error);
    alert('Error deleting sale. Please try again.');
    return;
  }

  await loadSales();
};

function updateChart() {
  const itemCounts = {};

  sales.forEach(sale => {
    sale.sale_items.forEach(saleItem => {
      const itemName = saleItem.items.name;
      itemCounts[itemName] = (itemCounts[itemName] || 0) + saleItem.quantity;
    });
  });

  const sortedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const labels = sortedItems.map(item => item[0]);
  const data = sortedItems.map(item => item[1]);

  if (chart) {
    chart.destroy();
  }

  const ctx = document.getElementById('trendChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Items Sold',
        data: data,
        backgroundColor: '#2563eb',
        borderColor: '#1d4ed8',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: labels.length === 0,
          text: 'No sales data available'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          grid: {
            color: '#e2e8f0'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

async function init() {
  await loadItems();
  await loadSales();
}

init();
