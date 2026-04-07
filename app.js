import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

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
const storage = getStorage(app);

// 🔴 ATENÇÃO: COLOQUE SEU E-MAIL AQUI PARA TER ACESSO TOTAL 🔴
const ADMIN_EMAIL = "admin@matsucafe.com"; 

async function loadSettings() {
    const configDoc = await getDoc(doc(db, "configuracoes", "loja"));
    if (configDoc.exists()) {
        const dados = configDoc.data();
        if (dados.corPrincipal) changeThemeColor(dados.corPrincipal);
        if (dados.logoUrl) {
            document.getElementById('app-logo-login').src = dados.logoUrl;
            document.getElementById('app-logo-sidebar').src = dados.logoUrl;
        }
    }
}

function changeThemeColor(hexColor) {
    document.getElementById('dynamic-theme').innerHTML = `:root { --theme-color: ${hexColor}; } .theme-bg { background-color: var(--theme-color) !important; } .theme-text { color: var(--theme-color) !important; } .theme-border { border-color: var(--theme-color) !important; }`;
    document.getElementById('theme-color-picker').value = hexColor;
}

document.getElementById('btn-save-theme').addEventListener('click', async () => {
    const selectedColor = document.getElementById('theme-color-picker').value;
    changeThemeColor(selectedColor);
    await setDoc(doc(db, "configuracoes", "loja"), { corPrincipal: selectedColor }, { merge: true });
    alert("Cor atualizada!");
});

document.getElementById('btn-upload-logo').addEventListener('click', async () => {
    const file = document.getElementById('logo-file-input').files[0];
    const statusText = document.getElementById('upload-status');
    if (!file) return alert("Selecione uma imagem primeiro!");
    try {
        statusText.classList.remove('hidden'); statusText.innerText = "Enviando...";
        const logoRef = ref(storage, 'configuracoes/logo_loja');
        await uploadBytes(logoRef, file);
        const downloadUrl = await getDownloadURL(logoRef);
        await setDoc(doc(db, "configuracoes", "loja"), { logoUrl: downloadUrl }, { merge: true });
        document.getElementById('app-logo-login').src = downloadUrl; document.getElementById('app-logo-sidebar').src = downloadUrl;
        statusText.innerText = "Logo atualizada!";
    } catch (error) { statusText.innerText = "Erro no upload."; }
});

// ==========================================
// LOGIN E NÍVEIS DE ACESSO
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const badge = document.getElementById('user-badge');
        const adminButtons = document.querySelectorAll('.admin-only');
        
        if (user.email === ADMIN_EMAIL) {
            badge.innerText = "MODO: GERÊNCIA";
            badge.className = "px-4 py-2 rounded-xl text-xs font-black shadow-sm bg-yellow-100 text-yellow-800 tracking-wide";
            adminButtons.forEach(btn => { btn.classList.remove('hidden'); btn.classList.add('flex'); });
            initDashboard(); 
        } else {
            badge.innerText = "MODO: CAIXA";
            badge.className = "px-4 py-2 rounded-xl text-xs font-black shadow-sm bg-gray-200 text-gray-700 tracking-wide";
            adminButtons.forEach(btn => { btn.classList.add('hidden'); btn.classList.remove('flex'); });
        }
        loadSettings(); loadProducts(); initKDS(); loadStock();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        loadSettings();
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => { document.getElementById('login-error').classList.add('hidden'); e.target.reset(); })
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => { switchTab('tab-pdv'); });
});

// ==========================================
// NAVEGAÇÃO DE ABAS
// ==========================================
function switchTab(tabId) {
    ['tab-pdv', 'tab-kds', 'tab-menu', 'tab-settings', 'tab-estoque', 'tab-financeiro'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(tabId).classList.remove('hidden');
}

document.getElementById('nav-pdv').addEventListener('click', () => switchTab('tab-pdv'));
document.getElementById('nav-kds').addEventListener('click', () => switchTab('tab-kds'));
document.getElementById('nav-menu').addEventListener('click', () => switchTab('tab-menu'));
document.getElementById('nav-settings').addEventListener('click', () => switchTab('tab-settings'));
document.getElementById('nav-estoque').addEventListener('click', () => switchTab('tab-estoque'));
document.getElementById('nav-financeiro').addEventListener('click', () => switchTab('tab-financeiro'));

// ==========================================
// DASHBOARD FINANCEIRO E ESTOQUE
// ==========================================
function initDashboard() {
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        let totalRevenue = 0; let totalOrders = 0;
        const historyList = document.getElementById('sales-history-list'); historyList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const pedido = docSnap.data();
            totalRevenue += pedido.total; totalOrders++;
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-sm transition';
            let statusCor = pedido.status === 'pendente' ? 'text-yellow-600 bg-yellow-100' : 'text-green-600 bg-green-100';
            div.innerHTML = `<div><p class="font-bold text-gray-800">Pedido #${docSnap.id.substring(0,4).toUpperCase()}</p><span class="text-[10px] px-2 py-1 rounded-md ${statusCor} uppercase font-bold mt-1 inline-block">${pedido.status}</span></div><div class="text-right"><p class="font-black text-lg text-gray-800">R$ ${pedido.total.toFixed(2).replace('.', ',')}</p></div>`;
            historyList.appendChild(div);
        });
        document.getElementById('dash-revenue').innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-orders').innerText = totalOrders;
        document.getElementById('dash-ticket').innerText = `R$ ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2).replace('.', ',') : '0,00'}`;
    });
}

function loadStock() {
    onSnapshot(collection(db, "estoque"), (snapshot) => {
        const list = document.getElementById('admin-stock-list'); list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const div = document.createElement('div');
            div.className = 'bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between';
            const qtyColor = item.quantidade < 10 ? 'text-red-500' : 'theme-text';
            div.innerHTML = `<div><p class="font-black text-xl text-gray-800">${item.nome}</p><p class="text-3xl ${qtyColor} font-black mt-2 mb-4">${item.quantidade} <span class="text-sm text-gray-400 font-medium">unid.</span></p></div><div class="flex gap-2 w-full"><button class="flex-1 bg-gray-100 py-3 rounded-xl text-gray-700 hover:bg-gray-200 font-black text-xl btn-minus">-</button><button class="flex-1 bg-gray-100 py-3 rounded-xl text-gray-700 hover:bg-gray-200 font-black text-xl btn-plus">+</button><button class="bg-red-50 text-red-500 px-4 py-3 rounded-xl hover:bg-red-100 btn-delete"><i class="ph ph-trash text-xl"></i></button></div>`;
            div.querySelector('.btn-plus').addEventListener('click', async () => { await updateDoc(doc(db, "estoque", docSnap.id), { quantidade: item.quantidade + 1 }); });
            div.querySelector('.btn-minus').addEventListener('click', async () => { await updateDoc(doc(db, "estoque", docSnap.id), { quantidade: item.quantidade - 1 }); });
            div.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Excluir?')) await deleteDoc(doc(db, "estoque", docSnap.id)); });
            list.appendChild(div);
        });
    });
}
document.getElementById('btn-add-stock').addEventListener('click', async () => {
    const nome = document.getElementById('new-stock-name').value;
    const qtd = parseInt(document.getElementById('new-stock-qty').value);
    if(!nome || isNaN(qtd)) return alert("Preencha corretamente!");
    await addDoc(collection(db, "estoque"), { nome: nome, quantidade: qtd });
    document.getElementById('new-stock-name').value = ''; document.getElementById('new-stock-qty').value = '';
});

// ==========================================
// GESTÃO DE CARDÁPIO COM IMAGENS
// ==========================================
let products = [];
async function loadProducts() {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    products = [];
    querySnapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
    renderProductsPDV(); renderProductsAdmin();
}

function renderProductsPDV() {
    const grid = document.getElementById('product-grid'); grid.innerHTML = '';
    products.forEach(product => {
        const imagemUrl = product.imagem || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80'; // Café genérico se não tiver foto
        const div = document.createElement('div');
        div.className = 'bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition transform duration-200 flex flex-col';
        div.innerHTML = `
            <img src="${imagemUrl}" alt="${product.nome}" class="w-full h-36 object-cover bg-gray-100">
            <div class="p-5 flex-1 flex flex-col justify-between">
                <h3 class="text-md font-bold text-gray-800 leading-tight mb-2">${product.nome}</h3>
                <p class="theme-text font-black text-lg">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p>
            </div>
        `;
        div.addEventListener('click', () => addToCart(product));
        grid.appendChild(div);
    });
}

function renderProductsAdmin() {
    const list = document.getElementById('admin-product-list'); list.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm';
        div.innerHTML = `<div><p class="font-black text-gray-800 text-lg">${product.nome}</p><p class="theme-text font-bold">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p></div><button class="bg-red-50 text-red-500 px-5 py-3 rounded-xl font-bold hover:bg-red-100 transition delete-btn">Excluir</button>`;
        div.querySelector('.delete-btn').addEventListener('click', async () => { if(confirm('Apagar produto?')) { await deleteDoc(doc(db, "produtos", product.id)); loadProducts(); } });
        list.appendChild(div);
    });
}

document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nome = document.getElementById('new-name').value;
    const preco = document.getElementById('new-price').value;
    const imagem = document.getElementById('new-image').value;
    if(!nome || !preco) return alert("Preencha nome e preço!");
    
    await addDoc(collection(db, "produtos"), { 
        nome: nome, 
        preco: parseFloat(preco),
        imagem: imagem // Agora salva a foto!
    });
    
    document.getElementById('new-name').value = ''; 
    document.getElementById('new-price').value = '';
    document.getElementById('new-image').value = '';
    loadProducts(); alert("Produto Cadastrado!");
});

// ==========================================
// CARRINHO E CHECKOUT
// ==========================================
let cart = []; let cartTotal = 0;
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty++; else cart.push({ ...product, qty: 1 });
    updateCartUI();
}
function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items'); const totalEl = document.getElementById('total');
    cartItemsDiv.innerHTML = ''; cartTotal = 0;
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-center text-gray-400 mt-10 font-medium">O carrinho está vazio.</p>';
    } else {
        cart.forEach((item) => {
            cartTotal += item.preco * item.qty;
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white border border-gray-100 p-4 rounded-2xl shadow-sm';
            div.innerHTML = `<div class="flex-1"><h4 class="text-sm font-bold text-gray-800">${item.nome}</h4><p class="text-xs text-gray-400">R$ ${item.preco.toFixed(2).replace('.', ',')} un</p></div><div class="bg-gray-50 px-3 py-1 rounded-lg font-black theme-text">${item.qty}x</div>`;
            cartItemsDiv.appendChild(div);
        });
    }
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
    const receipt = `<div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="margin: 0; font-size: 18px;">MATSUCAFE</h2><p style="margin: 0; font-size: 10px;">*** RECIBO DE VENDA ***</p></div><div style="padding: 10px 0; border-bottom: 1px dashed #000; margin-bottom: 10px; font-family: monospace;">${itemsHtml}</div><div style="display:flex; justify-content:space-between; font-weight:bold; font-size: 16px;"><span>TOTAL:</span><span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span></div>`;
    document.getElementById('print-section').innerHTML = receipt; window.print();
    cart = []; updateCartUI();
});

// ==========================================
// KDS (COZINHA)
// ==========================================
function initKDS() {
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        const kdsGrid = document.getElementById('kds-grid'); kdsGrid.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const pedido = docSnap.data();
            if(pedido.status !== "pendente") return; 
            const div = document.createElement('div');
            div.className = 'bg-white p-6 rounded-[2rem] shadow-sm border-t-8 border-yellow-400 flex flex-col justify-between';
            let itensHtml = '';
            pedido.itens.forEach(item => { itensHtml += `<p class="font-black text-lg border-b border-gray-100 py-3 text-gray-700">${item.qty}x ${item.nome}</p>`; });
            div.innerHTML = `<div class="flex justify-between items-center mb-6"><span class="text-gray-400 font-bold uppercase text-sm">Pedido #${docSnap.id.substring(0,4)}</span><span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-xs font-black animate-pulse">AGUARDANDO</span></div><div class="flex-1 mb-8">${itensHtml}</div><button class="bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-green-600 transition w-full btn-pronto shadow-md"><i class="ph ph-check-circle mr-2"></i> Pronto</button>`;
            div.querySelector('.btn-pronto').addEventListener('click', async () => { await updateDoc(doc(db, "pedidos", docSnap.id), { status: "pronto" }); });
            kdsGrid.appendChild(div);
        });
    });
}
