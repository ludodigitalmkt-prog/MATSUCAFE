import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
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

// 🔴 SEU E-MAIL DE GESTÃO 🔴
const ADMIN_EMAIL = "gestao@matsu.com"; 

let products = []; let clients = []; let cart = []; let cartTotal = 0;
let systemSettings = {
    nome: "Matsucafe", cnpj: "00.000.000/0001-00", endereco: "", telefone: "", rodape: "Obrigado pela preferência!",
    showCpf: false, showTel: false, showHora: true
};

// ==========================================
// 1. LEITOR DE CÓDIGO DE BARRAS
// ==========================================
let barcodeBuffer = ''; let barcodeTimeout;
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) handleBarcodeScan(barcodeBuffer);
        barcodeBuffer = '';
    } else if (e.key !== 'Shift') {
        barcodeBuffer += e.key; clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => { barcodeBuffer = ''; }, 100);
    }
});
function handleBarcodeScan(code) {
    if (!document.getElementById('tab-menu').classList.contains('hidden')) { document.getElementById('prod-barcode').value = code; return; }
    const product = products.find(p => p.barcode === code);
    if (product) {
        addToCart(product);
        const bg = document.body.style.backgroundColor; document.body.style.backgroundColor = '#dcfce3'; setTimeout(() => document.body.style.backgroundColor = bg, 150);
    } else alert("Produto não encontrado: " + code);
}

// ==========================================
// 2. CONFIGURAÇÕES GERAIS E LOGIN
// ==========================================
async function loadSettings() {
    const configDoc = await getDoc(doc(db, "configuracoes", "loja"));
    if (configDoc.exists()) {
        const dados = configDoc.data();
        
        if (dados.corPrincipal) {
            document.getElementById('dynamic-theme').innerHTML = `:root { --theme-color: ${dados.corPrincipal}; } .theme-bg { background-color: var(--theme-color) !important; } .theme-text { color: var(--theme-color) !important; } .theme-border { border-color: var(--theme-color) !important; }`;
            document.getElementById('theme-color-picker').value = dados.corPrincipal;
        }
        if (dados.logoUrl) {
            document.getElementById('app-logo-login').src = dados.logoUrl; document.getElementById('app-logo-sidebar').src = dados.logoUrl;
        }
        
        document.getElementById('cfg-empresa-nome').value = dados.nome || "";
        document.getElementById('cfg-empresa-cnpj').value = dados.cnpj || "";
        document.getElementById('cfg-empresa-endereco').value = dados.endereco || "";
        document.getElementById('cfg-empresa-telefone').value = dados.telefone || "";
        document.getElementById('cfg-recibo-rodape').value = dados.rodape || "";
        document.getElementById('cfg-show-cpf').checked = dados.showCpf || false;
        document.getElementById('cfg-show-tel').checked = dados.showTel || false;
        document.getElementById('cfg-show-hora').checked = dados.showHora ?? true;

        systemSettings = { ...systemSettings, ...dados };
    }
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-settings'); btn.innerText = "Salvando...";
    const dados = {
        corPrincipal: document.getElementById('theme-color-picker').value,
        nome: document.getElementById('cfg-empresa-nome').value,
        cnpj: document.getElementById('cfg-empresa-cnpj').value,
        endereco: document.getElementById('cfg-empresa-endereco').value,
        telefone: document.getElementById('cfg-empresa-telefone').value,
        rodape: document.getElementById('cfg-recibo-rodape').value,
        showCpf: document.getElementById('cfg-show-cpf').checked,
        showTel: document.getElementById('cfg-show-tel').checked,
        showHora: document.getElementById('cfg-show-hora').checked
    };
    const file = document.getElementById('logo-file-input').files[0];
    if (file) {
        try {
            const logoRef = ref(storage, 'configuracoes/logo_loja');
            await uploadBytes(logoRef, file);
            dados.logoUrl = await getDownloadURL(logoRef);
        } catch (e) { alert("Configure o CORS no Firebase Storage via Google Cloud Shell para enviar imagens."); }
    }
    await setDoc(doc(db, "configuracoes", "loja"), dados, { merge: true });
    await loadSettings(); 
    btn.innerHTML = `<i class="ph ph-check mr-2"></i> Salvo com Sucesso!`;
    setTimeout(() => { btn.innerHTML = `<i class="ph ph-floppy-disk mr-2"></i> Salvar Todas as Configurações`; }, 3000);
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

function switchTab(tabId) {
    ['tab-pdv', 'tab-crm', 'tab-menu', 'tab-settings', 'tab-financeiro'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}
['nav-pdv', 'nav-crm', 'nav-menu', 'nav-settings', 'nav-financeiro'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => switchTab(id.replace('nav-', 'tab-')));
});

// ==========================================
// 3. CRM (CLIENTES)
// ==========================================
function loadCRM() {
    onSnapshot(collection(db, "clientes"), (snapshot) => {
        clients = [];
        const list = document.getElementById('crm-list'); list.innerHTML = '';
        const select = document.getElementById('pdv-cliente'); 
        select.innerHTML = '<option value="">Cliente Padrão (Avulso)</option>';
        
        snapshot.forEach((docSnap) => {
            const c = { id: docSnap.id, ...docSnap.data() }; 
            clients.push(c);
            select.innerHTML += `<option value="${c.id}">${c.nome} (${c.tipo})</option>`;
            
            const div = document.createElement('div');
            div.className = 'bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between';
            div.innerHTML = `<div><div class="flex justify-between items-start mb-2"><h3 class="font-black text-xl text-gray-800">${c.nome}</h3><span class="text-xs font-bold px-2 py-1 rounded-md ${c.tipo === 'Colaborador' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${c.tipo}</span></div><p class="text-sm text-gray-500">${c.telefone || 'Sem telefone'}</p><p class="text-sm text-gray-400 mt-1">CPF: ${c.cpf || 'Não info.'}</p></div><button class="bg-red-50 text-red-500 px-4 py-3 rounded-xl hover:bg-red-100 font-bold mt-4 btn-delete">Excluir</button>`;
            div.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Apagar cliente?')) await deleteDoc(doc(db, "clientes", c.id)); });
            list.appendChild(div);
        });
    });
}

document.getElementById('btn-add-crm').addEventListener('click', async () => {
    const nome = document.getElementById('crm-nome').value; 
    if(!nome) return alert("Preencha o nome!");
    await addDoc(collection(db, "clientes"), { nome, telefone: document.getElementById('crm-telefone').value, cpf: document.getElementById('crm-cpf').value, tipo: document.getElementById('crm-tipo').value, dataCadastro: serverTimestamp() });
    ['crm-nome','crm-telefone','crm-cpf'].forEach(id => document.getElementById(id).value = '');
});

// ==========================================
// 4. PRODUTOS E ESTOQUE
// ==========================================
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = [];
        const grid = document.getElementById('product-grid'); grid.innerHTML = '';
        const list = document.getElementById('admin-product-list'); list.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const p = { id: docSnap.id, nome: data.nome || 'Sem Nome', preco: Number(data.preco) || 0, custo: Number(data.custo) || 0, estoque: Number(data.estoque) || 0, unidade: data.unidade || 'un', barcode: data.barcode || '', imagem: data.imagem || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80' };
            products.push(p);

            const div = document.createElement('div');
            div.className = 'bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition transform duration-200 flex flex-col';
            div.innerHTML = `<img src="${p.imagem}" class="w-full h-32 object-cover bg-gray-100"><div class="p-4 flex-1 flex flex-col justify-between"><h3 class="text-sm font-bold text-gray-800 leading-tight mb-2">${p.nome}</h3><div class="flex justify-between items-end"><p class="theme-text font-black text-lg">R$ ${p.preco.toFixed(2).replace('.', ',')}</p><span class="text-xs text-gray-400 bg-gray-100 px-2 rounded-md">Qtd: ${p.estoque}</span></div></div>`;
            div.addEventListener('click', () => addToCart(p)); 
            grid.appendChild(div);

            const divAdmin = document.createElement('div');
            divAdmin.className = 'flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm';
            divAdmin.innerHTML = `<div><p class="font-black text-gray-800 text-lg">${p.nome} <span class="text-xs text-gray-400 font-normal">(${p.barcode || 'Sem Barcode'})</span></p><p class="text-gray-500 font-bold">Venda: R$ ${p.preco.toFixed(2)} | Custo: R$ ${p.custo.toFixed(2)} | Est: ${p.estoque}${p.unidade}</p></div><button class="bg-red-50 text-red-500 px-5 py-3 rounded-xl font-bold hover:bg-red-100 transition btn-delete">Excluir</button>`;
            divAdmin.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm('Apagar produto?')) await deleteDoc(doc(db, "produtos", p.id)); });
            list.appendChild(divAdmin);
        });
    });
}

document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nome = document.getElementById('prod-nome').value; const preco = parseFloat(document.getElementById('prod-venda').value);
    if(!nome || isNaN(preco)) return alert("Nome e Preço obrigatórios!");
    await addDoc(collection(db, "produtos"), { barcode: document.getElementById('prod-barcode').value, nome: nome, unidade: document.getElementById('prod-unidade').value, estoque: parseInt(document.getElementById('prod-estoque').value) || 0, custo: parseFloat(document.getElementById('prod-custo').value) || 0, preco: preco, validade: document.getElementById('prod-validade').value, imagem: document.getElementById('prod-imagem').value });
    ['prod-barcode','prod-nome','prod-unidade','prod-estoque','prod-custo','prod-venda','prod-validade','prod-imagem'].forEach(id => document.getElementById(id).value = '');
});

// ==========================================
// 5. CAIXA (CARRINHO E RECIBO INTELIGENTE)
// ==========================================
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty++; else cart.push({ ...product, qty: 1 });
    updateCartUI();
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items'); const totalEl = document.getElementById('total');
    cartItemsDiv.innerHTML = ''; cartTotal = 0;
    if (cart.length === 0) cartItemsDiv.innerHTML = '<p class="text-center text-gray-400 mt-10 font-medium">Carrinho Vazio.</p>';
    else cart.forEach((item) => {
        cartTotal += item.preco * item.qty;
        const div = document.createElement('div'); 
        div.className = 'flex justify-between items-center bg-white border border-gray-100 p-4 rounded-2xl shadow-sm';
        div.innerHTML = `<div class="flex-1"><h4 class="text-sm font-bold text-gray-800">${item.nome}</h4><p class="text-xs text-gray-400">R$ ${item.preco.toFixed(2).replace('.', ',')} un</p></div><div class="bg-gray-50 px-3 py-1 rounded-lg font-black theme-text">${item.qty}x</div>`;
        cartItemsDiv.appendChild(div);
    });
    totalEl.innerText = `R$ ${cartTotal.toFixed(2).replace('.', ',')}`;
}
document.getElementById('btn-clear').addEventListener('click', () => { cart = []; updateCartUI(); });

document.getElementById('btn-checkout').addEventListener('click', async () => {
    if(cart.length === 0) return alert("Carrinho vazio!");
    
    const clienteId = document.getElementById('pdv-cliente').value;
    const clienteData = clients.find(c => c.id === clienteId) || { nome: 'Avulso', cpf: '', telefone: '' };
    const pagamento = document.getElementById('pdv-pagamento').value;
    const nroPedido = Math.floor(100000 + Math.random() * 900000); 
    
    try { await addDoc(collection(db, "vendas"), { nroPedido, itens: cart, total: cartTotal, cliente: clienteData.nome, pagamento: pagamento, data: serverTimestamp() });
    } catch(e) { return alert("Erro no banco."); }
    
    // CONSTRUÇÃO DO RECIBO COM AS CHAVES LIGA/DESLIGA DAS CONFIGURAÇÕES
    let itemsHtml = '';
    cart.forEach(item => { itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${item.qty}x ${item.nome}</span><span>R$ ${(item.preco * item.qty).toFixed(2).replace('.', ',')}</span></div>`; });
    
    const dataObj = new Date();
    const optionsDate = systemSettings.showHora ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' };
    const dataHoraStr = dataObj.toLocaleString('pt-BR', optionsDate);
    
    let infoClienteHtml = `<p style="font-size: 10px;"><b>Cliente:</b> ${clienteData.nome}</p>`;
    if(systemSettings.showCpf && clienteData.cpf) infoClienteHtml += `<p style="font-size: 10px;"><b>CPF:</b> ${clienteData.cpf}</p>`;
    if(systemSettings.showTel && clienteData.telefone) infoClienteHtml += `<p style="font-size: 10px;"><b>Tel:</b> ${clienteData.telefone}</p>`;

    const receipt = `
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${systemSettings.nome}</h2>
        <p style="margin: 0; font-size: 10px;">CNPJ: ${systemSettings.cnpj}</p>
        <p style="margin: 0; font-size: 10px;">${systemSettings.endereco}</p>
        <p style="margin: 0; font-size: 10px;">Tel: ${systemSettings.telefone}</p>
        <br>
        <p style="margin: 0; font-size: 12px; font-weight: bold;">*** RECIBO DE VENDA ***</p>
    </div>
    <p style="font-size: 10px;"><b>Pedido:</b> #${nroPedido}</p>
    <p style="font-size: 10px;"><b>Data:</b> ${dataHoraStr}</p>
    <p style="font-size: 10px;"><b>Pagamento:</b> ${pagamento}</p>
    ${infoClienteHtml}
    
    <div style="padding: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 10px 0; font-family: monospace;">${itemsHtml}</div>
    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size: 16px;"><span>TOTAL:</span><span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span></div>
    
    <p style="text-align: center; font-size: 10px; margin-top: 20px;">${systemSettings.rodape}</p>
    `;
    
    document.getElementById('print-section').innerHTML = receipt; window.print();
    cart = []; updateCartUI();
});

// ==========================================
// 6. DASHBOARD FINANCEIRO (COM DELETE)
// ==========================================
function initDashboard() {
    onSnapshot(collection(db, "vendas"), (snapshot) => {
        let totalRevenue = 0; let totalVouchers = 0; let totalOrders = 0;
        const historyList = document.getElementById('sales-history-list'); historyList.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const venda = docSnap.data();
            totalOrders++;
            if (venda.pagamento === 'Voucher') totalVouchers += venda.total;
            else totalRevenue += venda.total;

            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-sm transition mb-3';
            const corPgto = venda.pagamento === 'Voucher' ? 'text-purple-600 bg-purple-100' : 'text-blue-600 bg-blue-100';
            
            div.innerHTML = `
                <div class="flex-1">
                    <p class="font-bold text-gray-800">Venda #${venda.nroPedido}</p>
                    <p class="text-xs text-gray-500 font-medium">Cliente: ${venda.cliente}</p>
                    <span class="text-[10px] px-2 py-1 rounded-md ${corPgto} uppercase font-bold mt-1 inline-block">${venda.pagamento}</span>
                </div>
                <div class="text-right mr-4">
                    <p class="font-black text-lg text-gray-800">R$ ${venda.total.toFixed(2).replace('.', ',')}</p>
                </div>
                <button class="bg-red-100 text-red-600 p-3 rounded-xl hover:bg-red-200 transition btn-delete-sale" title="Cancelar Venda">
                    <i class="ph ph-trash text-xl"></i>
                </button>
            `;
            
            div.querySelector('.btn-delete-sale').addEventListener('click', async () => {
                if(confirm(`EXCLUIR a Venda #${venda.nroPedido}? O valor sumirá do Faturamento.`)) {
                    await deleteDoc(doc(db, "vendas", docSnap.id));
                }
            });
            historyList.appendChild(div);
        });
        
        document.getElementById('dash-revenue').innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-vouchers').innerText = `R$ ${totalVouchers.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-orders').innerText = totalOrders;
    });
}
