import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
// Adicionado signOut
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

// ==========================================
// 1. CONFIGURAÇÕES (CORES E LOGO)
// ==========================================
const ADMIN_EMAIL = "admin@matsucafe.com"; // <--- SEU EMAIL AQUI

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
    document.getElementById('dynamic-theme').innerHTML = `:root { --theme-color: ${hexColor}; } .theme-bg { background-color: var(--theme-color) !important; } .theme-text { color: var(--theme-color) !important; }`;
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
        statusText.classList.remove('hidden'); statusText.innerText = "Fazendo upload... Aguarde.";
        const logoRef = ref(storage, 'configuracoes/logo_loja');
        await uploadBytes(logoRef, file);
        const downloadUrl = await getDownloadURL(logoRef);
        await setDoc(doc(db, "configuracoes", "loja"), { logoUrl: downloadUrl }, { merge: true });
        document.getElementById('app-logo-login').src = downloadUrl; document.getElementById('app-logo-sidebar').src = downloadUrl;
        statusText.innerText = "Logo atualizada com sucesso!";
    } catch (error) { statusText.innerText = "Erro ao enviar imagem."; }
});

// ==========================================
// 2. LOGIN E LOGOUT REAIS
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const badge = document.getElementById('user-badge');
        const adminButtons = document.querySelectorAll('.admin-only');
        
        if (user.email === ADMIN_EMAIL) {
            badge.innerText = "Modo: Dono";
            badge.classList.replace('text-gray-600', 'text-yellow-700'); badge.classList.replace('bg-gray-100', 'bg-yellow-100');
            adminButtons.forEach(btn => { btn.classList.remove('hidden'); btn.classList.add('flex'); });
            initDashboard(); // Inicia o Dashboard só para o dono
        } else {
            badge.innerText = "Modo: Colaborador";
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
    const errorMsg = document.getElementById('login-error');
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => { errorMsg.classList.add('hidden'); e.target.reset(); })
        .catch(() => errorMsg.classList.remove('hidden'));
});

// Botão de Sair Real
document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => { switchTab('tab-pdv'); }); // Desloga e volta pra aba padrão
});

// ==========================================
// 3. NAVEGAÇÃO DE ABAS
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
document.getElementById('nav-financeiro').addEventListener('click', () => switchTab('tab-financeiro')); // Aba Financeira

// ==========================================
// 4. DASHBOARD FINANCEIRO (NOVO)
// ==========================================
function initDashboard() {
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        let totalRevenue = 0;
        let totalOrders = 0;
        const historyList = document.getElementById('sales-history-list');
        historyList.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const pedido = docSnap.data();
            totalRevenue += pedido.total;
            totalOrders++;

            // Histórico de Vendas Visual
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100';
            
            let statusCor = pedido.status === 'pendente' ? 'text-yellow-600' : 'text-green-600';
            
            div.innerHTML = `
                <div>
                    <p class="font-bold text-sm">Pedido #${docSnap.id.substring(0,4).toUpperCase()}</p>
                    <p class="text-xs ${statusCor} uppercase font-bold">${pedido.status}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-gray-800">R$ ${pedido.total.toFixed(2).replace('.', ',')}</p>
                </div>
            `;
            historyList.appendChild(div);
        });

        // Atualiza os Cards
        document.getElementById('dash-revenue').innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-orders').innerText = totalOrders;
        
        let ticketMedio = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
    });
}

// ==========================================
// 5. ESTOQUE
// ==========================================
let stockItems = [];
function loadStock() {
    onSnapshot(collection(db, "estoque"), (snapshot) => {
        const list = document.getElementById('admin-stock-list');
        list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm';
            const qtyColor = item.quantidade < 10 ? 'text-red-600' : 'text-green-700';
            div.innerHTML = `<div><p class="font-bold text-gray-800">${item.nome}</p><p class="text-sm ${qtyColor} font-bold mt-1">Qtd: ${item.quantidade}</p></div><div class="flex gap-2"><button class="bg-gray-100 px-3 py-1 rounded text-gray-600 hover:bg-gray-200 btn-minus">-</button><button class="bg-gray-100 px-3 py-1 rounded text-gray-600 hover:bg-gray-200 btn-plus">+</button><button class="bg-red-100 text-red-600 px-3 py-1 rounded ml-2 hover:bg-red-200 btn-delete"><i class="ph ph-trash"></i></button></div>`;
            div.querySelector('.btn-plus').addEventListener('click', async () => { await updateDoc(doc(db, "estoque", docSnap.id), { quantidade: item.quantidade + 1 }); });
            div.querySelector('.btn-minus').addEventListener('click', async () => { await updateDoc(doc(db, "estoque", docSnap.id), { quantidade: item.quantidade - 1 }); });
            div.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Excluir este insumo?')) await deleteDoc(doc(db, "estoque", docSnap.id)); });
            list.appendChild(div);
        });
    });
}
document.getElementById('btn-add-stock').addEventListener('click', async () => {
    const nome = document.getElementById('new-stock-name').value;
    const qtd = parseInt(document.getElementById('new-stock-qty').value);
    if(!nome || isNaN(qtd)) return alert("Preencha nome e quantidade válida!");
    await addDoc(collection(db, "estoque"), { nome: nome, quantidade: qtd });
    document.getElementById('new-stock-name').value = ''; document.getElementById('new-stock-qty').value = '';
});

// ==========================================
// 6. GESTÃO DE CARDÁPIO E CARRINHO
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
        div.querySelector('.delete-btn').addEventListener('click', async () => { if(confirm('Apagar produto?')) { await deleteDoc(doc(db, "produtos", product.id)); loadProducts(); } });
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
// 7. KDS (TELA DA COZINHA)
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
