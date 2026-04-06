// 1. IMPORTAÇÕES DO FIREBASE (Versão 10 - Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

// 2. SUA CONFIGURAÇÃO DO FIREBASE (Matsucafe)
const firebaseConfig = {
  apiKey: "AIzaSyCE_lxmrON0o2mHsj8olNaRIFKcgz6oQc8",
  authDomain: "matsucafe-cf8b4.firebaseapp.com",
  projectId: "matsucafe-cf8b4",
  storageBucket: "matsucafe-cf8b4.firebasestorage.app",
  messagingSenderId: "265449982587",
  appId: "1:265449982587:web:431b285d16e44767d470de"
};

// 3. INICIALIZAR O FIREBASE
const app = initializeApp(firebaseConfig);
console.log("Firebase conectado com sucesso ao projeto:", firebaseConfig.projectId);

// ---------------------------------------------------
// LÓGICA DO PDV E CARRINHO
// ---------------------------------------------------

const products = [
    { id: 1, name: 'Cappuccino Tradicional', price: 14.50, image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=200&q=80' },
    { id: 2, name: 'Latte Macchiato', price: 16.00, image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=200&q=80' },
    { id: 3, name: 'Espresso Duplo', price: 9.00, image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=200&q=80' },
    { id: 4, name: 'Croissant Francês', price: 12.00, image: 'https://images.unsplash.com/photo-1555507036-ab1f40ce88cb?auto=format&fit=crop&w=200&q=80' }
];

let cart = [];

function renderProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transform transition hover:scale-105 active:scale-95';
        div.onclick = () => addToCart(product);
        div.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="w-full h-32 object-cover">
            <div class="p-3">
                <h3 class="text-sm font-bold text-gray-800 line-clamp-2">${product.name}</h3>
                <p class="text-green-700 font-bold mt-1">R$ ${product.price.toFixed(2).replace('.', ',')}</p>
            </div>
        `;
        grid.appendChild(div);
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items');
    const totalEl = document.getElementById('total');
    const subtotalEl = document.getElementById('subtotal');
    const countEl = document.getElementById('cart-count');

    cartItemsDiv.innerHTML = '';
    let total = 0;
    let count = 0;

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-center text-gray-400 mt-10">O carrinho está vazio.</p>';
    } else {
        cart.forEach((item, index) => {
            total += item.price * item.qty;
            count += item.qty;
            cartItemsDiv.innerHTML += `
                <div class="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                    <div class="flex-1">
                        <h4 class="text-sm font-bold text-gray-800">${item.name}</h4>
                        <p class="text-xs text-gray-500">R$ ${item.price.toFixed(2).replace('.', ',')} un</p>
                    </div>
                    <div class="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                        <button class="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-red-500 font-bold" onclick="changeQty(${index}, -1)">-</button>
                        <span class="font-bold text-sm w-4 text-center">${item.qty}</span>
                        <button class="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-green-700 font-bold" onclick="changeQty(${index}, 1)">+</button>
                    </div>
                </div>
            `;
        });
    }

    const formattedTotal = `R$ ${total.toFixed(2).replace('.', ',')}`;
    totalEl.innerText = formattedTotal;
    subtotalEl.innerText = formattedTotal;
    countEl.innerText = count;
}

function changeQty(index, amount) {
    cart[index].qty += amount;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
}

function clearCart() {
    cart = [];
    updateCartUI();
}

// ---------------------------------------------------
// LÓGICA DE IMPRESSÃO DO RECIBO
// ---------------------------------------------------

function getFormattedDateTime() {
    const now = new Date();
    return now.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function checkout() {
    if(cart.length === 0) {
        return alert("Adicione itens ao carrinho primeiro!");
    }

    const cnpj = "00.000.000/0001-00"; // Substitua pelo seu CNPJ real
    const companyName = "MATSUCAFE - CAFETERIA ARTESANAL";
    const address = "Araucária - PR";
    const dateTime = getFormattedDateTime();
    const orderNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    let itemsHtml = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        itemsHtml += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>${item.qty}x ${item.name}</span>
                <span>R$ ${itemTotal.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    });

    const receiptHtml = `
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 16px;">${companyName}</h2>
            <p style="margin: 2px 0;">CNPJ: ${cnpj}</p>
            <p style="margin: 2px 0; font-size: 10px;">${address}</p>
        </div>
        
        <p style="margin: 5px 0;"><strong>Pedido: #${orderNumber}</strong></p>
        <p style="margin: 5px 0; font-size: 10px;">Data/Hora: ${dateTime}</p>
        
        <div style="border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 10px;">
            <strong style="display: block; margin-bottom: 5px;">ITENS:</strong>
            ${itemsHtml}
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
            <span>TOTAL:</span>
            <span>R$ ${total.toFixed(2).replace('.', ',')}</span>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 11px;">
            <p>Obrigado pela preferência!</p>
            <p>*** NÃO É DOCUMENTO FISCAL ***</p>
        </div>
    `;

    const printSection = document.getElementById('print-section');
    printSection.innerHTML = receiptHtml;

    // Dispara a janela de impressão
    window.print();

    clearCart();
    
    const panel = document.getElementById('cart-panel');
    if (panel && !panel.classList.contains('translate-y-full')) {
        toggleCartMobile();
    }
}

function toggleCartMobile() {
    const panel = document.getElementById('cart-panel');
    if(panel) panel.classList.toggle('translate-y-full');
}

// Expõe as funções para o HTML
window.addToCart = addToCart;
window.changeQty = changeQty;
window.clearCart = clearCart;
window.checkout = checkout;
window.toggleCartMobile = toggleCartMobile;

// Inicializa o sistema
renderProducts();

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registrado!');
        }).catch(err => console.log('Erro no Service Worker:', err));
    });
}
