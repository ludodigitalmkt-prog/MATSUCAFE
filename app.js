import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
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

// 🔴 COLOQUE SEU E-MAIL AQUI 🔴
const ADMIN_EMAIL = "gestao@matsu.com"; 

// ==========================================
// 1. GLOBAL: LEITOR DE CÓDIGO DE BARRAS
// ==========================================
let barcodeBuffer = '';
let barcodeTimeout;

document.addEventListener('keydown', (e) => {
    // Um leitor de código de barras imita um teclado digitando muito rápido e apertando "Enter" no final.
    if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
            handleBarcodeScan(barcodeBuffer); // Processa o código
        }
        barcodeBuffer = '';
    } else if (e.key !== 'Shift') {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        // Se demorar mais de 100ms entre as teclas, foi um humano digitando, então limpa.
        barcodeTimeout = setTimeout(() => { barcodeBuffer = ''; }, 100);
    }
});

function handleBarcodeScan(code) {
    // Verifica se estamos na aba de cadastro de produto. Se sim, joga o código no input.
    if (!document.getElementById('tab-menu').classList.contains('hidden')) {
        document.getElementById('prod-barcode').value = code;
        return;
    }
    
    // Se estiver no PDV, procura o produto e joga no carrinho
    const product = products.find(p => p.barcode === code);
    if (product) {
        addToCart(product);
        // Feedback visual/sonoro pequeno
        const bg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = '#dcfce3';
        setTimeout(() => document.body.style.backgroundColor = bg, 150);
    } else {
        alert("Produto não encontrado no sistema: " + code);
    }
}


// ==========================================
// 2. CONFIGURAÇÕES E LOGIN
// ==========================================
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
    const color = document.getElementById('theme-color-picker').value;
    changeThemeColor(color);
    await setDoc(doc(db, "configuracoes", "loja"), { corPrincipal: color }, { merge: true });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const adminButtons = document.querySelectorAll('.admin-only');
        if (user.email === ADMIN_EMAIL) {
            adminButtons.forEach(btn => { btn.classList.remove('hidden'); btn.classList.add('flex'); });
            initDashboard(); 
        } else {
            adminButtons.forEach(btn => { btn.classList.add('hidden'); btn.classList.remove('flex'); });
        }
        loadSettings(); loadProducts(); loadCRM();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        loadSettings();
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
        .then(() => { document.getElementById('login-error').classList.add('hidden'); e.target.reset(); })
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
});
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth).then(() => switchTab('tab-pdv')); });

// NAVEGAÇÃO
function switchTab(tabId) {
    ['tab-pdv', 'tab-crm', 'tab-menu', 'tab-settings', 'tab-financeiro'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}
document.getElementById('nav-pdv').addEventListener('click', () => switchTab('tab-pdv'));
document.getElementById('nav-crm').addEventListener('click', () => switchTab('tab-crm'));
document.getElementById('nav-menu').addEventListener('click', () => switchTab('tab-menu'));
document.getElementById('nav-settings').addEventListener('click', () => switchTab('tab-settings'));
document.getElementById('nav-financeiro').addEventListener('click', () => switchTab('tab-financeiro'));

// ==========================================
// 3. CRM (CLIENTES)
// ==========================================
let clients = [];
function loadCRM() {
    onSnapshot(collection(db, "clientes"), (snapshot) => {
        clients = [];
        const list = document.getElementById('crm-list'); list.innerHTML = '';
        const select = document.getElementById('pdv-cliente'); 
        select.innerHTML = '<option value="">Cliente Padrão (Avulso)</option>'; // Reseta select do PDV

        snapshot.forEach((docSnap) => {
            const c = docSnap.data();
            c.id = docSnap.id;
            clients.push(c);

            // Popula PDV
            select.innerHTML += `<option value="${c.nome}">${c.nome} (${c.tipo})</option>`;

            // Popula Tela de CRM
            const div = document.createElement('div');
            div.className = 'bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between';
            const tagColor = c.tipo === 'Colaborador' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
            
            div.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-xl text-gray-800">${c.nome}</h3>
                        <span class="text-xs font-bold px-2 py-1 rounded-md ${tagColor}">${c.tipo}</span>
                    </div>
                    <p class="text-sm text-gray-500"><i class="ph ph-phone"></i> ${c.telefone || 'Sem telefone'}</p>
                    <p class="text-sm text-gray-500"><i class="ph ph-identification-card"></i> ${c.cpf || 'Sem CPF'}</p>
                </div>
                <button class="bg-red-50 text-red-500 px-4 py-3 rounded-xl hover:bg-red-100 font-bold mt-4 btn-delete">Excluir</button>
            `;
            div.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Apagar?')) await deleteDoc(doc(db, "clientes", c.id)); });
            list.appendChild(div);
        });
    });
}

document.getElementById('btn-add-crm').addEventListener('click', async () => {
    const nome = document.getElementById('crm-nome').value;
    const tel = document.getElementById('crm-telefone').value;
    const cpf = document.getElementById('crm-cpf').value;
    const tipo = document.getElementById('crm-tipo').value;
    if(!nome) return alert("Preencha o nome!");
    await addDoc(collection(db, "clientes"), { nome, telefone: tel, cpf, tipo, dataCadastro: serverTimestamp() });
    document.getElementById('crm-nome').value = ''; document.getElementById('crm-telefone').value = ''; document.getElementById('crm-cpf').value = '';
});

// ==========================================
// 4. PRODUTOS AVANÇADOS
// ==========================================
let products = [];
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = [];
        const grid = document.getElementById('product-grid'); grid.innerHTML = '';
        const list = document.getElementById('admin-product-list'); list.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() };
            products.push(p);

            // Renderiza no Caixa (PDV)
            const img = p.imagem || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80';
            const div = document.createElement('div');
            div.className = 'bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition transform duration-200 flex flex-col';
            div.innerHTML = `<img src="${img}" class="w-full h-32 object-cover bg-gray-100"><div class="p-4 flex-1 flex flex-col justify-between"><h3 class="text-sm font-bold text-gray-800 leading-tight mb-2">${p.nome}</h3><div class="flex justify-between items-end"><p class="theme-text font-black text-lg">R$ ${p.preco.toFixed(2).replace('.', ',')}</p><span class="text-xs text-gray-400 bg-gray-100 px-2 rounded-md">Qtd: ${p.estoque}</span></div></div>`;
            div.addEventListener('click', () => addToCart(p));
            grid.appendChild(div);

            // Renderiza na Administração
            const divAdmin = document.createElement('div');
            divAdmin.className = 'flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm';
            divAdmin.innerHTML = `<div><p class="font-black text-gray-800 text-lg">${p.nome} <span class="text-xs text-gray-400 font-normal">(${p.barcode || 'Sem Barcode'})</span></p><p class="text-gray-500 font-bold">Venda: R$ ${p.preco.toFixed(2)} | Custo: R$ ${p.custo.toFixed(2)} | Est: ${p.estoque}${p.unidade}</p></div><button class="bg-red-50 text-red-500 px-5 py-3 rounded-xl font-bold hover:bg-red-100 transition btn-delete">Excluir</button>`;
            divAdmin.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Apagar?')) await deleteDoc(doc(db, "produtos", p.id)); });
            list.appendChild(divAdmin);
        });
    });
}

document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nome = document.getElementById('prod-nome').value;
    const preco = parseFloat(document.getElementById('prod-venda').value);
    const custo = parseFloat(document.getElementById('prod-custo').value) || 0;
    const estoque = parseInt(document.getElementById('prod-estoque').value) || 0;
    
    if(!nome || isNaN(preco)) return alert("Nome e Preço de venda são obrigatórios!");
    
    await addDoc(collection(db, "produtos"), { 
        barcode: document.getElementById('prod-barcode').value,
        nome: nome, 
        unidade: document.getElementById('prod-unidade').value,
        estoque: estoque,
        custo: custo,
        preco: preco,
        validade: document.getElementById('prod-validade').value,
        imagem: document.getElementById('prod-imagem').value 
    });
    
    ['prod-barcode','prod-nome','prod-unidade','prod-estoque','prod-custo','prod-venda','prod-validade','prod-imagem'].forEach(id => document.getElementById(id).value = '');
    alert("Produto/Lote Salvo!");
});

// ==========================================
// 5. CAIXA, VENDA E RECIBO
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
        cartItemsDiv.innerHTML = '<p class="text-center text-gray-400 mt-10 font-medium">Carrinho Vazio.</p>';
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
    
    const cliente = document.getElementById('pdv-cliente').value || 'Avulso';
    const pagamento = document.getElementById('pdv-pagamento').value;
    const nroPedido = Math.floor(100000 + Math.random() * 900000); // Nro Único 6 digitos
    
    try {
        await addDoc(collection(db, "vendas"), { 
            nroPedido, itens: cart, total: cartTotal, 
            cliente: cliente, pagamento: pagamento, data: serverTimestamp() 
        });
    } catch(e) { return alert("Erro no banco de dados ao salvar a venda."); }
    
    // Imprimir Recibo
    let itemsHtml = '';
    cart.forEach(item => { itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${item.qty}x ${item.nome}</span><span>R$ ${(item.preco * item.qty).toFixed(2).replace('.', ',')}</span></div>`; });
    
    const dataHora = new Date().toLocaleString('pt-BR');
    
    const receipt = `
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px;">MATSUCAFE</h2>
        <p style="margin: 0; font-size: 10px;">CNPJ: 00.000.000/0001-00</p>
        <p style="margin: 0; font-size: 10px;">*** RECIBO DE VENDA ***</p>
    </div>
    <p style="font-size: 10px;"><b>Pedido:</b> #${nroPedido}</p>
    <p style="font-size: 10px;"><b>Data:</b> ${dataHora}</p>
    <p style="font-size: 10px;"><b>Cliente:</b> ${cliente}</p>
    <p style="font-size: 10px;"><b>Pagamento:</b> ${pagamento}</p>
    
    <div style="padding: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 10px 0; font-family: monospace;">${itemsHtml}</div>
    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size: 16px;"><span>TOTAL:</span><span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span></div>
    <p style="text-align: center; font-size: 10px; margin-top: 15px;">Obrigado pela preferência!</p>
    `;
    
    document.getElementById('print-section').innerHTML = receipt; window.print();
    cart = []; updateCartUI();
});

// ==========================================
// 6. DASHBOARD FINANCEIRO E VOUCHERS
// ==========================================
function initDashboard() {
    // Escuta a coleção "vendas" agora
    onSnapshot(collection(db, "vendas"), (snapshot) => {
        let totalRevenue = 0; let totalVouchers = 0; let totalOrders = 0;
        const historyList = document.getElementById('sales-history-list'); historyList.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const venda = docSnap.data();
            totalOrders++;
            if (venda.pagamento === 'Voucher') {
                totalVouchers += venda.total; // Soma nos "A receber"
            } else {
                totalRevenue += venda.total; // Soma no faturamento real
            }

            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-sm transition';
            const corPgto = venda.pagamento === 'Voucher' ? 'text-purple-600 bg-purple-100' : 'text-blue-600 bg-blue-100';
            
            div.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800">Venda #${venda.nroPedido}</p>
                    <p class="text-xs text-gray-500 font-medium">Cliente: ${venda.cliente}</p>
                    <span class="text-[10px] px-2 py-1 rounded-md ${corPgto} uppercase font-bold mt-1 inline-block">${venda.pagamento}</span>
                </div>
                <div class="text-right"><p class="font-black text-lg text-gray-800">R$ ${venda.total.toFixed(2).replace('.', ',')}</p></div>
            `;
            historyList.appendChild(div);
        });
        
        document.getElementById('dash-revenue').innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-vouchers').innerText = `R$ ${totalVouchers.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-orders').innerText = totalOrders;
    });
}
