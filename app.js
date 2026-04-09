import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

const ADMIN_EMAIL = "gestao@matsu.com"; 
let products = []; let clients = []; let cart = []; let cartTotal = 0;
let currentDateFilter = new Date().toISOString().split('T')[0];

// ==========================================
// NAVEGAÇÃO E AUTENTICAÇÃO
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const isAdmin = user.email === ADMIN_EMAIL;
        document.querySelectorAll('.admin-only').forEach(btn => btn.classList.toggle('hidden', !isAdmin));
        loadProducts(); loadCRM(); loadQuebras(); initDashboard();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

function switchTab(tabId) {
    document.querySelectorAll('main').forEach(m => m.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}
['nav-pdv', 'nav-crm', 'nav-menu', 'nav-quebras', 'nav-financeiro', 'nav-settings'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => switchTab(id.replace('nav-', 'tab-')));
});

// ==========================================
// GESTÃO DE PRODUTOS (EDIÇÃO E LOTES)
// ==========================================
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = [];
        const list = document.getElementById('admin-product-list');
        const quebraSelect = document.getElementById('quebra-produto');
        list.innerHTML = ''; quebraSelect.innerHTML = '<option value="">Selecione o Produto</option>';
        
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() };
            products.push(p);

            // Tabela Admin
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 transition";
            
            const isVencendo = p.validade && new Date(p.validade) <= new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);
            
            tr.innerHTML = `
                <td class="p-5 flex items-center gap-3">
                    <img src="${p.imagem}" class="w-10 h-10 rounded-lg object-cover">
                    <span class="font-bold">${p.nome}</span>
                </td>
                <td class="p-5"><span class="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold">${p.categoria}</span></td>
                <td class="p-5 font-black">${p.estoque} <span class="text-gray-400 text-[10px]">${p.unidade || 'un'}</span></td>
                <td class="p-5 font-bold ${isVencendo ? 'text-red-500 animate-pulse' : 'text-gray-400'}">${p.validade ? new Date(p.validade).toLocaleDateString() : '---'}</td>
                <td class="p-5 text-right">
                    <button class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg btn-edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                    <button class="text-red-500 hover:bg-red-50 p-2 rounded-lg btn-del"><i class="ph ph-trash text-xl"></i></button>
                </td>
            `;
            
            tr.querySelector('.btn-edit').onclick = () => openEditModal(p);
            tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir permanentemente?')) await deleteDoc(doc(db, "produtos", p.id)); };
            list.appendChild(tr);

            quebraSelect.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
        });
        buildCategoryTabs();
    });
}

function openEditModal(p) {
    document.getElementById('modal-title').innerText = "Editar Produto";
    document.getElementById('edit-id').value = p.id;
    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-categoria').value = p.categoria;
    document.getElementById('prod-barcode').value = p.barcode || '';
    document.getElementById('prod-venda').value = p.preco;
    document.getElementById('prod-custo').value = p.custo;
    document.getElementById('prod-estoque').value = p.estoque;
    document.getElementById('prod-validade').value = p.validade || '';
    document.getElementById('prod-imagem').value = p.imagem;
    document.getElementById('modal-produto').classList.remove('hidden');
}

document.getElementById('btn-save-product').onclick = async () => {
    const id = document.getElementById('edit-id').value;
    const data = {
        nome: document.getElementById('prod-nome').value,
        categoria: document.getElementById('prod-categoria').value || 'Geral',
        barcode: document.getElementById('prod-barcode').value,
        preco: parseFloat(document.getElementById('prod-venda').value),
        custo: parseFloat(document.getElementById('prod-custo').value),
        estoque: parseInt(document.getElementById('prod-estoque').value),
        validade: document.getElementById('prod-validade').value,
        imagem: document.getElementById('prod-imagem').value || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80'
    };

    if(id) await updateDoc(doc(db, "produtos", id), data);
    else await addDoc(collection(db, "produtos"), { ...data, dataEntrada: serverTimestamp() });
    
    document.getElementById('modal-produto').classList.add('hidden');
    document.querySelectorAll('#modal-produto input').forEach(i => i.value = '');
};

// ==========================================
// MÓDULO DE QUEBRAS (DESPERDÍCIOS)
// ==========================================
async function loadQuebras() {
    onSnapshot(collection(db, "quebras"), (snapshot) => {
        const list = document.getElementById('quebra-list'); list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const q = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl flex justify-between items-center border border-red-50 shadow-sm";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-red-600">${q.produtoNome} x${q.qtd}</p>
                    <p class="text-xs text-gray-400">${q.motivo} | Perda: R$ ${(q.valorPerda || 0).toFixed(2)}</p>
                </div>
                <button onclick="deleteQuebra('${docSnap.id}', '${q.produtoId}', ${q.qtd})" class="text-gray-300 hover:text-red-500"><i class="ph ph-trash"></i></button>
            `;
            list.appendChild(div);
        });
    });
}

document.getElementById('btn-add-quebra').onclick = async () => {
    const pId = document.getElementById('quebra-produto').value;
    const qty = parseInt(document.getElementById('quebra-qty').value);
    const p = products.find(prod => prod.id === pId);
    
    if(!p || !qty) return alert("Selecione o produto e a quantidade");
    
    await addDoc(collection(db, "quebras"), {
        produtoId: pId, produtoNome: p.nome, qtd: qty, 
        motivo: document.getElementById('quebra-motivo').value,
        valorPerda: p.custo * qty, data: serverTimestamp(),
        dataSimples: new Date().toISOString().split('T')[0]
    });
    
    await updateDoc(doc(db, "produtos", pId), { estoque: p.estoque - qty });
    document.getElementById('quebra-qty').value = '';
};

// ==========================================
// FINANCEIRO COM FILTROS E IMPRESSÃO
// ==========================================
document.getElementById('filtro-data').value = currentDateFilter;
document.getElementById('filtro-data').onchange = (e) => {
    currentDateFilter = e.target.value;
    initDashboard();
};

function initDashboard() {
    onSnapshot(collection(db, "vendas"), (snapVendas) => {
        onSnapshot(collection(db, "quebras"), (snapQuebras) => {
            let totalVendas = 0; let totalQuebras = 0;
            const history = document.getElementById('sales-history-list'); history.innerHTML = '';

            snapVendas.forEach(docSnap => {
                const v = docSnap.data();
                const vData = v.data?.toDate ? v.data.toDate().toISOString().split('T')[0] : '';
                if(vData === currentDateFilter) {
                    totalVendas += v.total;
                    const div = document.createElement('div');
                    div.className = "bg-white p-4 rounded-2xl flex justify-between border";
                    div.innerHTML = `<span>Venda #${v.nroPedido} - ${v.cliente}</span> <b>R$ ${v.total.toFixed(2)}</b>`;
                    history.appendChild(div);
                }
            });

            snapQuebras.forEach(docSnap => {
                const q = docSnap.data();
                if(q.dataSimples === currentDateFilter) totalQuebras += q.valorPerda;
            });

            document.getElementById('dash-revenue').innerText = `R$ ${totalVendas.toFixed(2)}`;
            document.getElementById('dash-loss').innerText = `R$ ${totalQuebras.toFixed(2)}`;
            document.getElementById('dash-net').innerText = `R$ ${(totalVendas - totalQuebras).toFixed(2)}`;
        });
    });
}

// Relatório do Dia (Impressão)
document.getElementById('btn-print-day').onclick = () => {
    const revenue = document.getElementById('dash-revenue').innerText;
    const loss = document.getElementById('dash-loss').innerText;
    const net = document.getElementById('dash-net').innerText;
    
    const printHtml = `
        <div style="text-align:center; font-family:monospace;">
            <h2>MATSUCAFE - FECHAMENTO</h2>
            <p>DATA: ${currentDateFilter}</p>
            <hr>
            <p>ENTRADAS: ${revenue}</p>
            <p>QUEBRAS: ${loss}</p>
            <h3>SALDO: ${net}</h3>
            <br><br>
            <p>__________________________</p>
            <p>ASSINATURA GESTOR</p>
        </div>
    `;
    document.getElementById('print-section').innerHTML = printHtml;
    window.print();
};

// ==========================================
// PDV (CONEXÃO COM O NOVO GRID)
// ==========================================
function buildCategoryTabs() {
    const categorias = ["Todos", ...new Set(products.map(p => p.categoria))];
    const container = document.getElementById('category-tabs');
    container.innerHTML = categorias.map(c => `
        <button class="px-6 py-2 rounded-xl font-bold whitespace-nowrap bg-gray-100 cat-btn" data-cat="${c}">${c}</button>
    `).join('');
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.replace('theme-bg', 'bg-gray-100'));
            btn.classList.replace('bg-gray-100', 'theme-bg');
            renderPdv(btn.dataset.cat);
        };
    });
    renderPdv('Todos');
}

function renderPdv(filtro) {
    const grid = document.getElementById('product-grid'); grid.innerHTML = '';
    const filtered = filtro === 'Todos' ? products : products.filter(p => p.categoria === filtro);
    
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md";
        div.innerHTML = `
            <img src="${p.imagem}" class="w-full h-24 object-cover rounded-2xl mb-2">
            <p class="text-xs font-bold truncate">${p.nome}</p>
            <p class="theme-text font-black">R$ ${p.preco.toFixed(2)}</p>
        `;
        div.onclick = () => addToCart(p);
        grid.appendChild(div);
    });
}

function addToCart(p) {
    const item = cart.find(i => i.id === p.id);
    if(item) item.qty++; else cart.push({...p, qty: 1});
    updateCart();
}

function updateCart() {
    const list = document.getElementById('cart-items'); list.innerHTML = '';
    cartTotal = 0;
    cart.forEach(item => {
        cartTotal += item.preco * item.qty;
        list.innerHTML += `<div class="flex justify-between"><span>${item.qty}x ${item.nome}</span> <b>R$ ${(item.preco * item.qty).toFixed(2)}</b></div>`;
    });
    document.getElementById('total').innerText = `R$ ${cartTotal.toFixed(2)}`;
}

document.getElementById('btn-checkout').onclick = async () => {
    if(!cart.length) return;
    const nro = Math.floor(1000 + Math.random() * 9000);
    await addDoc(collection(db, "vendas"), {
        nroPedido: nro, total: cartTotal, 
        cliente: document.getElementById('pdv-cliente').value || 'Avulso',
        data: serverTimestamp()
    });
    // Baixa de estoque
    for(const item of cart) {
        const p = products.find(prod => prod.id === item.id);
        await updateDoc(doc(db, "produtos", p.id), { estoque: p.estoque - item.qty });
    }
    cart = []; updateCart(); alert('Venda Concluída!');
};
