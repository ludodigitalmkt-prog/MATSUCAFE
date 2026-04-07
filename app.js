import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCE_lxmrON0o2mHsj8olNaRIFKcgz6oQc8",
  authDomain: "matsucafe-cf8b4.firebaseapp.com",
  projectId: "matsucafe-cf8b4",
  storageBucket: "matsucafe-cf8b4.firebasestorage.app",
  messagingSenderId: "265449982587",
  appId: "1:265449982587:web:431b285d16e44767d470de"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 1. CONFIGURAÇÕES, CORES E SEGURANÇA
// ==========================================

// COLOQUE SEU E-MAIL DE DONO AQUI PARA LIBERAR TUDO:
const ADMIN_EMAIL = "admin@matsucafe.com"; 

async function loadSettings() {
    const configDoc = await getDoc(doc(db, "configuracoes", "loja"));
    if (configDoc.exists()) {
        const cor = configDoc.data().corPrincipal;
        if (cor) changeThemeColor(cor);
    }
}

function changeThemeColor(hexColor) {
    document.getElementById('dynamic-theme').innerHTML = `
        :root { --theme-color: ${hexColor}; }
        .theme-bg { background-color: var(--theme-color) !important; }
        .theme-text { color: var(--theme-color) !important; }
    `;
    document.getElementById('theme-color-picker').value = hexColor;
}

// Salva a nova cor no banco de dados para todos os usuários
document.getElementById('btn-save-theme').addEventListener('click', async () => {
    const selectedColor = document.getElementById('theme-color-picker').value;
    changeThemeColor(selectedColor);
    await setDoc(doc(db, "configuracoes", "loja"), { corPrincipal: selectedColor }, { merge: true });
    alert("Cor do sistema atualizada com sucesso!");
});

// ==========================================
// 2. LÓGICA DE LOGIN E NÍVEIS DE ACESSO
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        
        // Verifica Nível de Acesso (Dono vs Barista)
        const badge = document.getElementById('user-badge');
        const adminButtons = document.querySelectorAll('.admin-only');
        
        if (user.email === ADMIN_EMAIL) {
            badge.innerText = "Modo: Dono";
            badge.classList.replace('text-gray-600', 'text-yellow-700');
            badge.classList.replace('bg-gray-100', 'bg-yellow-100');
            adminButtons.forEach(btn => {
                btn.classList.remove('hidden'); // Libera os botões!
                btn.classList.add('flex');
            });
        } else {
            badge.innerText = "Modo: Colaborador";
            // Os botões continuam hidden por padrão no HTML
        }

        loadSettings(); // Carrega a cor salva
        loadProducts(); // Carrega o cardápio
        initKDS();      // Inicia a cozinha
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => errorMsg.classList.add('hidden'))
        .catch(() => errorMsg.classList.remove('hidden'));
});

// ==========================================
// 3. SISTEMA DE ABAS (NAVEGAÇÃO)
// ==========================================
function switchTab(tabId) {
    ['tab-pdv', 'tab-kds', 'tab-menu', 'tab-settings'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(tabId).classList.remove('hidden');
}

document.getElementById('nav-pdv').addEventListener('click', () => switchTab('tab-pdv'));
document.getElementById('nav-kds').addEventListener('click', () => switchTab('tab-kds'));
document.getElementById('nav-menu').addEventListener('click', () => switchTab('tab-menu'));
document.getElementById('nav-settings').addEventListener('click', () => switchTab('tab-settings'));

// ==========================================
// 4. GESTÃO DE CARDÁPIO (FIRESTORE)
// ==========================================
let products = [];
async function loadProducts() {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    products = [];
    querySnapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
    renderProductsPDV(); renderProductsAdmin();
}

function renderProductsPDV() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:scale-105 transition';
        div.innerHTML = `<h3 class="text-sm font-bold text-gray-800">${product.nome}</h3><p class="theme-text font-bold mt-1">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p>`;
        div.addEventListener('click', () => addToCart(product));
        grid.appendChild(div);
    });
}

function renderProductsAdmin() {
    const list = document.getElementById('admin-product-list');
    list.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200';
        div.innerHTML = `<div><p class="font-bold">${product.nome}</p><p class="text-sm text-gray-500">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p></div><button class="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold delete-btn">Excluir</button>`;
        div.querySelector('.delete-btn').addEventListener('click', async () => {
            if(confirm('Apagar produto?')) { await deleteDoc(doc(db, "produtos", product.id)); loadProducts(); }
        });
        list.appendChild(div);
    });
}

document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nome = document.getElementById('new-name').value;
    const preco = document.getElementById('new-price').value;
    if(!nome || !preco) return alert("Preencha nome e preço!");
    await addDoc(collection(db, "produtos"), { nome: nome, preco: parseFloat(preco) });
    document.getElementById('new-name').value = ''; document.getElementById('new-price').value = '';
    loadProducts(); alert("Adicionado!");
});

// ==========================================
// 5. CARRINHO E CHECKOUT
// ==========================================
let cart = []; let cartTotal = 0;
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty++; else cart.push({ ...product, qty: 1 });
    updateCartUI();
}
function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items');
    const totalEl = document.getElementById('total');
    cartItemsDiv.innerHTML = ''; cartTotal = 0;
    cart.forEach((item) => {
        cartTotal += item.preco * item.qty;
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-white border p-3 rounded-xl';
        div.innerHTML = `<div class="flex-1"><h4 class="text-sm font-bold">${item.nome}</h4></div><div class="flex items-center gap-3"><span class="font-bold">${item.qty}x</span></div>`;
        cartItemsDiv.appendChild(div);
    });
    totalEl.innerText = `R$ ${cartTotal.toFixed(2).replace('.', ',')}`;
}
document.getElementById('btn-clear').addEventListener('click', () => { cart = []; updateCartUI(); });

document.getElementById('btn-checkout').addEventListener('click', async () => {
    if(cart.length === 0) return alert("Carrinho vazio!");
    try {
        await addDoc(collection(db, "pedidos"), { itens: cart, total: cartTotal, status: "pendente", data: serverTimestamp() });
    } catch(e) { return alert("Erro no banco."); }
    
    let itemsHtml = '';
    cart.forEach(item => { itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${item.qty}x ${item.nome}</span><span>R$ ${(item.preco * item.qty).toFixed(2).replace('.', ',')}</span></div>`; });
    const receipt = `<div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="margin: 0;">MATSUCAFE</h2><p style="margin: 0; font-size: 10px;">*** RECIBO DE VENDA ***</p></div><div style="padding: 10px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;">${itemsHtml}</div><div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span></div>`;
    document.getElementById('print-section').innerHTML = receipt; window.print();
    cart = []; updateCartUI();
});

// ==========================================
// 6. KDS (TELA DA COZINHA)
// ==========================================
function initKDS() {
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        const kdsGrid = document.getElementById('kds-grid');
        kdsGrid.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const pedido = docSnap.data();
            if(pedido.status !== "pendente") return; 
            const div = document.createElement('div');
            div.className = 'bg-white p-5 rounded-2xl shadow-md border-l-8 border-yellow-400 flex flex-col';
            let itensHtml = '';
            pedido.itens.forEach(item => { itensHtml += `<p class="font-bold text-lg border-b py-2">${item.qty}x ${item.nome}</p>`; });
            div.innerHTML = `<div class="flex justify-between items-center mb-4"><span class="text-gray-500 font-bold">Pedido #${docSnap.id.substring(0,4).toUpperCase()}</span></div><div class="flex-1 mb-6">${itensHtml}</div><button class="bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 w-full btn-pronto"><i class="ph ph-check-circle mr-2"></i> Marcar Pronto</button>`;
            div.querySelector('.btn-pronto').addEventListener('click', async () => { await updateDoc(doc(db, "pedidos", docSnap.id), { status: "pronto" }); });
            kdsGrid.appendChild(div);
        });
    });
}
