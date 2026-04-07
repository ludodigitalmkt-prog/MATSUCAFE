import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
// NOVAS IMPORTAÇÕES ADICIONADAS: onSnapshot, serverTimestamp, updateDoc
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
// 1. LÓGICA DE LOGIN
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        loadProducts(); // Carrega o cardápio
        initKDS();      // INICIA O MONITORAMENTO DA COZINHA
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
// 2. SISTEMA DE ABAS (NAVEGAÇÃO)
// ==========================================
function switchTab(tabId) {
    document.getElementById('tab-pdv').classList.add('hidden');
    document.getElementById('tab-menu').classList.add('hidden');
    document.getElementById('tab-kds').classList.add('hidden'); // Esconde o KDS também
    document.getElementById(tabId).classList.remove('hidden');
}

document.getElementById('nav-pdv').addEventListener('click', () => switchTab('tab-pdv'));
document.getElementById('nav-menu').addEventListener('click', () => switchTab('tab-menu'));
document.getElementById('nav-kds').addEventListener('click', () => switchTab('tab-kds'));


// ==========================================
// 3. GESTÃO DE CARDÁPIO
// ==========================================
let products = [];

async function loadProducts() {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    products = [];
    querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() });
    });
    renderProductsPDV();
    renderProductsAdmin();
}

function renderProductsPDV() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:scale-105 transition';
        div.innerHTML = `
            <h3 class="text-sm font-bold text-gray-800">${product.nome}</h3>
            <p class="text-green-700 font-bold mt-1">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p>
        `;
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
        div.innerHTML = `
            <div>
                <p class="font-bold">${product.nome}</p>
                <p class="text-sm text-gray-500">R$ ${parseFloat(product.preco).toFixed(2).replace('.', ',')}</p>
            </div>
            <button class="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold delete-btn">Excluir</button>
        `;
        div.querySelector('.delete-btn').addEventListener('click', async () => {
            if(confirm('Tem certeza que quer apagar este produto?')) {
                await deleteDoc(doc(db, "produtos", product.id));
                loadProducts(); 
            }
        });
        list.appendChild(div);
    });
}

document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nome = document.getElementById('new-name').value;
    const preco = document.getElementById('new-price').value;
    if(!nome || !preco) return alert("Preencha nome e preço!");

    await addDoc(collection(db, "produtos"), { nome: nome, preco: parseFloat(preco) });

    document.getElementById('new-name').value = '';
    document.getElementById('new-price').value = '';
    loadProducts(); 
    alert("Produto adicionado com sucesso!");
});


// ==========================================
// 4. CARRINHO E CHECKOUT (AGORA SALVANDO NO BANCO)
// ==========================================
let cart = [];
let cartTotal = 0; // Guardamos o total para usar no Firebase

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty++;
    else cart.push({ ...product, qty: 1 });
    updateCartUI();
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items');
    const totalEl = document.getElementById('total');
    cartItemsDiv.innerHTML = '';
    cartTotal = 0;

    cart.forEach((item) => {
        cartTotal += item.preco * item.qty;
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-white border p-3 rounded-xl';
        div.innerHTML = `
            <div class="flex-1"><h4 class="text-sm font-bold">${item.nome}</h4></div>
            <div class="flex items-center gap-3"><span class="font-bold">${item.qty}x</span></div>
        `;
        cartItemsDiv.appendChild(div);
    });
    totalEl.innerText = `R$ ${cartTotal.toFixed(2).replace('.', ',')}`;
}

document.getElementById('btn-clear').addEventListener('click', () => { cart = []; updateCartUI(); });

// NOVA LÓGICA DE COBRAR E SALVAR
document.getElementById('btn-checkout').addEventListener('click', async () => {
    if(cart.length === 0) return alert("Carrinho vazio!");
    
    // 1. SALVA O PEDIDO NO FIREBASE (Vai para a tela do KDS)
    try {
        await addDoc(collection(db, "pedidos"), {
            itens: cart,
            total: cartTotal,
            status: "pendente", // status inicial para a cozinha fazer
            data: serverTimestamp()
        });
    } catch(e) {
        console.error("Erro ao salvar pedido: ", e);
        return alert("Erro ao conectar com o banco. Venda não registrada.");
    }
    
    // 2. MONTA O RECIBO E IMPRIME
    let itemsHtml = '';
    cart.forEach(item => {
        itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${item.qty}x ${item.nome}</span><span>R$ ${(item.preco * item.qty).toFixed(2).replace('.', ',')}</span></div>`;
    });

    const receipt = `
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0;">MATSUCAFE</h2>
            <p style="margin: 0; font-size: 10px;">*** RECIBO DE VENDA ***</p>
        </div>
        <div style="padding: 10px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;">${itemsHtml}</div>
        <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span></div>
    `;

    document.getElementById('print-section').innerHTML = receipt;
    window.print();
    
    // 3. LIMPA O CARRINHO
    cart = [];
    updateCartUI();
});


// ==========================================
// 5. KDS (TELA DA COZINHA) - MAGIA DO TEMPO REAL
// ==========================================
function initKDS() {
    // onSnapshot escuta as mudanças em tempo real. Entrou venda, aparece na tela!
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        const kdsGrid = document.getElementById('kds-grid');
        kdsGrid.innerHTML = ''; // Limpa a tela para remontar

        snapshot.forEach((docSnap) => {
            const pedido = docSnap.data();
            
            // Só mostra na cozinha se o status for "pendente"
            if(pedido.status !== "pendente") return; 

            const div = document.createElement('div');
            // Card visual com borda amarela de "Atenção"
            div.className = 'bg-white p-5 rounded-2xl shadow-md border-l-8 border-yellow-400 flex flex-col';

            let itensHtml = '';
            pedido.itens.forEach(item => {
                itensHtml += `<p class="font-bold text-lg border-b py-2">${item.qty}x ${item.nome}</p>`;
            });

            div.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <span class="text-gray-500 font-bold">Pedido #${docSnap.id.substring(0,4).toUpperCase()}</span>
                    <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Na Fila</span>
                </div>
                <div class="flex-1 mb-6">
                    ${itensHtml}
                </div>
                <button class="bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 w-full btn-pronto shadow-md transition">
                    <i class="ph ph-check-circle mr-2"></i> Marcar como Pronto
                </button>
            `;

            // Ação do Botão: Muda o status no banco para "pronto", e o onSnapshot tira ele da tela automaticamente
            div.querySelector('.btn-pronto').addEventListener('click', async () => {
                await updateDoc(doc(db, "pedidos", docSnap.id), { status: "pronto" });
            });

            kdsGrid.appendChild(div);
        });
    });
}
