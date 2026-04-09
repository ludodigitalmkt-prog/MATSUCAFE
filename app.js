import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCE_lxmrON0o2mHsj8olNaRIFKcgz6oQc8",
  authDomain: "matsucafe-cf8b4.firebaseapp.com",
  projectId: "matsucafe-cf8b4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "gestao@matsu.com"; 
let products = []; let clients = []; let combos = []; let cart = []; let cartTotal = 0;
let currentDateFilter = new Date().toISOString().split('T')[0];
let currentClientHistory = null;
let appConfig = { nome: "Matsucafe", cnpj: "", endereco: "", telefone: "", msg: "Obrigado e volte sempre!" };

// ==========================================
// TEMA E NAVEGAÇÃO
// ==========================================
document.querySelectorAll('.theme-selector').forEach(btn => {
    btn.onclick = () => {
        const color = btn.dataset.color;
        document.getElementById('dynamic-theme').innerHTML = `:root { --theme-color: ${color}; } .theme-bg { background-color: var(--theme-color) !important; } .theme-text { color: var(--theme-color) !important; } .theme-border { border-color: var(--theme-color) !important; }`;
    };
});

function switchTab(tabId) {
    document.querySelectorAll('main').forEach(m => m.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}
['nav-pdv', 'nav-crm', 'nav-menu', 'nav-combos', 'nav-quebras', 'nav-financeiro', 'nav-settings'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => switchTab(id.replace('nav-', 'tab-')));
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const isAdmin = user.email === ADMIN_EMAIL;
        document.querySelectorAll('.admin-only').forEach(btn => btn.classList.toggle('hidden', !isAdmin));
        loadSettings(); loadProducts(); loadCombos(); loadCRM(); loadQuebras(); initDashboard();
    } else { document.getElementById('login-screen').style.display = 'flex'; }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
});

// ==========================================
// CONFIGURAÇÕES
// ==========================================
function loadSettings() {
    onSnapshot(doc(db, "config", "loja"), (docSnap) => {
        if(docSnap.exists()) {
            appConfig = docSnap.data();
            document.getElementById('cfg-nome').value = appConfig.nome || '';
            document.getElementById('cfg-cnpj').value = appConfig.cnpj || '';
            document.getElementById('cfg-endereco').value = appConfig.endereco || '';
            document.getElementById('cfg-telefone').value = appConfig.telefone || '';
            document.getElementById('cfg-msg').value = appConfig.msg || '';
        }
    });
}
document.getElementById('btn-save-cfg').onclick = async () => {
    await setDoc(doc(db, "config", "loja"), {
        nome: document.getElementById('cfg-nome').value, cnpj: document.getElementById('cfg-cnpj').value,
        endereco: document.getElementById('cfg-endereco').value, telefone: document.getElementById('cfg-telefone').value,
        msg: document.getElementById('cfg-msg').value
    });
    alert("Configurações salvas!");
};

// ==========================================
// CRM (CLIENTES E COLABORADORES)
// ==========================================
function loadCRM() {
    onSnapshot(collection(db, "clientes"), (snapshot) => {
        clients = []; snapshot.forEach(d => clients.push({ id: d.id, ...d.data() }));
        renderCRM(); updatePDVClients();
    });
}

function updatePDVClients() {
    const pdvSelect = document.getElementById('pdv-cliente');
    pdvSelect.innerHTML = '<option value="Avulso">Cliente Avulso</option>';
    clients.forEach(c => pdvSelect.innerHTML += `<option value="${c.nome}">${c.nome} (${c.tipo})</option>`);
}

document.getElementById('pdv-cliente').addEventListener('change', (e) => {
    const nome = e.target.value;
    const c = clients.find(cli => cli.nome === nome);
    const infoDiv = document.getElementById('pdv-voucher-info');
    if(c && c.tipo === 'Colaborador') {
        const saldo = parseFloat(c.saldo_voucher || c.voucher || 0);
        document.getElementById('pdv-voucher-saldo').innerText = `R$ ${saldo.toFixed(2)}`;
        infoDiv.classList.remove('hidden');
    } else {
        infoDiv.classList.add('hidden');
    }
});

function renderCRM(searchTerm = '') {
    const list = document.getElementById('crm-list'); list.innerHTML = '';
    const filtered = clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    
    filtered.forEach(c => {
        const isColab = c.tipo === 'Colaborador';
        const limiteReal = parseFloat(c.voucher || 0).toFixed(2);
        const saldoReal = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0).toFixed(2);
        
        const limitInfo = isColab ? `<br><span class="text-[10px] text-purple-600 font-bold">Limite: R$ ${limiteReal} | Restante: R$ ${saldoReal}</span>` : '';
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50 transition cursor-pointer";
        tr.innerHTML = `
            <td class="p-4 font-bold text-gray-800" onclick="window.openHistoryModal('${c.nome}')">${c.nome}</td>
            <td class="p-4" onclick="window.openHistoryModal('${c.nome}')"><span class="${isColab ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'} px-3 py-1 rounded-full text-xs font-bold">${c.tipo}</span>${limitInfo}</td>
            <td class="p-4 text-gray-500" onclick="window.openHistoryModal('${c.nome}')">${c.telefone || '---'}</td>
            <td class="p-4 text-right">
                <button class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg btn-edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                <button class="text-red-500 hover:bg-red-50 p-2 rounded-lg btn-del"><i class="ph ph-trash text-xl"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit').onclick = () => window.openClientModal(c);
        tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir contato?')) await deleteDoc(doc(db, "clientes", c.id)); };
        list.appendChild(tr);
    });
}

document.getElementById('search-cliente').addEventListener('input', (e) => renderCRM(e.target.value));

document.getElementById('btn-save-client').onclick = async () => {
    const id = document.getElementById('cli-id').value;
    const isColab = document.getElementById('cli-tipo').value === 'Colaborador';
    const valorVoucher = parseFloat(document.getElementById('cli-voucher').value || 0);

    const data = {
        nome: document.getElementById('cli-nome').value, 
        telefone: document.getElementById('cli-telefone').value,
        tipo: document.getElementById('cli-tipo').value, 
        voucher: isColab ? valorVoucher : 0
    };
    
    // Se for cadastro novo ou não tiver saldo, define o saldo igual ao limite
    if(!id) data.saldo_voucher = data.voucher;

    if(id) await updateDoc(doc(db, "clientes", id), data); else await addDoc(collection(db, "clientes"), data);
    window.closeModals();
};

window.loadClientHistory = async () => {
    if(!currentClientHistory) return;
    const inicio = document.getElementById('hist-data-inicio').value;
    const fim = document.getElementById('hist-data-fim').value;
    const q = query(collection(db, "vendas"), where("cliente", "==", currentClientHistory));
    const snap = await getDocs(q);
    
    let total = 0; const lista = document.getElementById('hist-lista'); lista.innerHTML = '';
    
    snap.forEach(doc => {
        const v = doc.data();
        if(inicio && fim && (v.dataSimples < inicio || v.dataSimples > fim)) return; 
        
        total += v.total;
        lista.innerHTML += `
            <div class="bg-white p-3 rounded-xl shadow-sm border text-sm flex justify-between items-center">
                <div><p class="font-bold">Pedido #${v.nroPedido}</p><p class="text-xs text-gray-500">${v.dataSimples.split('-').reverse().join('/')} - Pgto: ${v.pagamento}</p></div>
                <div class="font-black text-green-600">R$ ${v.total.toFixed(2)}</div>
            </div>
        `;
    });
    document.getElementById('hist-total').innerText = `R$ ${total.toFixed(2)}`;
    if(lista.innerHTML === '') lista.innerHTML = '<p class="text-gray-400 text-center text-sm p-4">Nenhuma compra encontrada.</p>';
};

// ==========================================
// ESTOQUE COM LOTES (Versão Inteligente)
// ==========================================
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = []; 
        const list = document.getElementById('admin-product-list'); 
        const quebraSelect = document.getElementById('quebra-produto');
        
        list.innerHTML = ''; quebraSelect.innerHTML = '<option value="">Selecione o Produto</option>';
        
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() }; 
            if(p.estoque !== undefined && !p.lotes) {
                p.estoque_total = p.estoque;
                p.lotes = [{ id_lote: Date.now().toString(), quantidade: p.estoque, data_entrada: p.validade || '-', validade: p.validade || '', tipo: 'unidade' }];
            }
            products.push(p);

            const totalEstoque = (p.lotes || []).reduce((acc, lote) => acc + lote.quantidade, 0);
            const lotesComEstoque = (p.lotes || []).filter(l => l.quantidade > 0 && l.validade);
            lotesComEstoque.sort((a, b) => new Date(a.validade) - new Date(b.validade));
            const loteMaisProximo = lotesComEstoque[0];

            let statusVencimentoHtml = '<span class="text-gray-400">Sem validade</span>';
            if (loteMaisProximo) {
                const dataValidade = new Date(loteMaisProximo.validade);
                dataValidade.setHours(0,0,0,0);
                const diffDias = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
                const dataFormatada = loteMaisProximo.validade.split('-').reverse().join('/');

                if (diffDias < 0) statusVencimentoHtml = `<span class="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-black animate-pulse">VENCIDO (${dataFormatada})</span>`;
                else if (diffDias <= 7) statusVencimentoHtml = `<span class="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-black">Alerta: ${diffDias} dias (${dataFormatada})</span>`;
                else if (diffDias <= 30) statusVencimentoHtml = `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-bold">Vence em ${diffDias} dias</span>`;
                else statusVencimentoHtml = `<span class="text-green-600 font-bold">${dataFormatada}</span>`;
            }

            const tr = document.createElement('tr'); 
            tr.className = "border-b hover:bg-gray-50 transition";
            tr.innerHTML = `
                <td class="p-5 flex items-center gap-3"><img src="${p.imagem}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                    <div><span class="font-black text-gray-800 block">${p.nome}</span><span class="text-[10px] text-gray-400 font-bold">${(p.lotes || []).length} lote(s)</span></div>
                </td>
                <td class="p-5"><span class="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold border">${p.categoria}</span></td>
                <td class="p-5 font-black text-lg ${totalEstoque <= 5 ? 'text-red-500' : 'text-blue-600'}">${totalEstoque} un</td>
                <td class="p-5">${statusVencimentoHtml}</td>
                <td class="p-5 text-right">
                    <button class="bg-blue-50 text-blue-500 hover:bg-blue-100 p-2 rounded-xl transition btn-add-lote" title="Add Lote/Editar"><i class="ph ph-plus-circle text-xl"></i></button> 
                    <button class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl transition btn-del"><i class="ph ph-trash text-xl"></i></button>
                </td>
            `;
            tr.querySelector('.btn-add-lote').onclick = () => window.openProductModal(p);
            tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir produto e lotes?')) await deleteDoc(doc(db, "produtos", p.id)); };
            list.appendChild(tr); quebraSelect.innerHTML += `<option value="${p.id}">${p.nome} (${totalEstoque} disp.)</option>`;
        });
        buildCategoryTabs();
    });
}

document.getElementById('btn-save-product').onclick = async () => {
    const id = document.getElementById('edit-id').value;
    const nomeProduto = document.getElementById('prod-nome').value.trim();
    const qtdLote = parseInt(document.getElementById('prod-estoque-lote').value || 0);
    
    if(!nomeProduto) return alert("O nome do produto é obrigatório!");

    const novoLote = { id_lote: `lote_${Date.now()}`, tipo: document.getElementById('prod-tipo-lote').value, quantidade: qtdLote, data_entrada: document.getElementById('prod-entrada').value || new Date().toISOString().split('T')[0], validade: document.getElementById('prod-validade').value };
    const dadosBaseProduto = { nome: nomeProduto, categoria: document.getElementById('prod-categoria').value || 'Geral', preco: parseFloat(document.getElementById('prod-venda').value || 0), custo: parseFloat(document.getElementById('prod-custo').value || 0), imagem: document.getElementById('prod-imagem').value || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80' };

    if (id) {
        const produtoAtual = products.find(p => p.id === id);
        let lotesAtuais = produtoAtual.lotes || [];
        if (qtdLote > 0) lotesAtuais.push(novoLote);
        const estoque_total = lotesAtuais.reduce((acc, l) => acc + l.quantidade, 0);
        await updateDoc(doc(db, "produtos", id), { ...dadosBaseProduto, lotes: lotesAtuais, estoque_total: estoque_total });
    } else {
        await addDoc(collection(db, "produtos"), { ...dadosBaseProduto, lotes: qtdLote > 0 ? [novoLote] : [], estoque_total: qtdLote });
    }
    window.closeModals();
};

// ==========================================
// COMBOS
// ==========================================
async function loadCombos() {
    onSnapshot(collection(db, "combos"), (snapshot) => {
        combos = []; const list = document.getElementById('combos-list'); list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const c = { id: docSnap.id, ...docSnap.data() }; combos.push(c);
            const itemsText = c.itens.map(i => `${i.nome}`).join(' + ');
            
            const div = document.createElement('div');
            div.className = "p-4 border rounded-2xl flex justify-between items-center hover:shadow-md transition bg-white";
            div.innerHTML = `
                <div><h4 class="font-black text-gray-800">${c.nome}</h4><p class="text-[10px] text-gray-500 font-bold">${itemsText}</p><p class="text-green-600 font-black mt-1">R$ ${c.preco.toFixed(2)}</p></div>
                <button class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl btn-del"><i class="ph ph-trash text-xl"></i></button>
            `;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir Combo?')) await deleteDoc(doc(db, "combos", c.id)); };
            list.appendChild(div);
        });
        buildCategoryTabs();
    });
}

document.getElementById('btn-save-combo').onclick = async () => {
    const nome = document.getElementById('combo-nome').value;
    const preco = parseFloat(document.getElementById('combo-preco').value || 0);
    const checkboxes = document.querySelectorAll('.combo-prod-check:checked');
    if(!nome || preco <= 0 || checkboxes.length === 0) return alert('Preencha nome, preço e selecione produtos!');
    
    const itensSelecionados = Array.from(checkboxes).map(cb => {
        const prod = products.find(p => p.id === cb.value);
        return { id: prod.id, nome: prod.nome, custo: prod.custo };
    });

    await addDoc(collection(db, "combos"), { nome, preco, itens: itensSelecionados, isCombo: true });
    window.closeModals();
};

// ==========================================
// QUEBRAS
// ==========================================
async function loadQuebras() {
    onSnapshot(collection(db, "quebras"), (snapshot) => {
        const list = document.getElementById('quebra-list'); list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const q = docSnap.data(); const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl flex justify-between items-center border border-red-50 shadow-sm";
            div.innerHTML = `<div><p class="font-bold text-red-600">${q.produtoNome} x${q.qtd}</p><p class="text-xs text-gray-400">${q.motivo} | Perda: R$ ${(q.valorPerda || 0).toFixed(2)}</p></div><button class="text-gray-300 hover:text-red-500 btn-del"><i class="ph ph-trash text-xl"></i></button>`;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Apagar registro?')) await deleteDoc(doc(db, "quebras", docSnap.id)); };
            list.appendChild(div);
        });
    });
}
document.getElementById('btn-add-quebra').onclick = async () => {
    const pId = document.getElementById('quebra-produto').value; const qty = parseInt(document.getElementById('quebra-qty').value);
    const p = products.find(prod => prod.id === pId);
    if(!p || !qty) return alert("Preencha corretamente!");
    await addDoc(collection(db, "quebras"), { produtoId: pId, produtoNome: p.nome, qtd: qty, motivo: document.getElementById('quebra-motivo').value || '-', valorPerda: p.custo * qty, data: serverTimestamp(), dataSimples: new Date().toISOString().split('T')[0] });
    const novoEstoque = (p.estoque_total || p.estoque) - qty;
    await updateDoc(doc(db, "produtos", pId), { estoque_total: novoEstoque });
    document.getElementById('quebra-qty').value = ''; document.getElementById('quebra-motivo').value = '';
};

// ==========================================
// FINANCEIRO AVANÇADO (LUCRO E VOUCHERS)
// ==========================================
document.getElementById('filtro-data').value = currentDateFilter;
document.getElementById('filtro-data').onchange = (e) => { currentDateFilter = e.target.value; initDashboard(); };

function initDashboard() {
    onSnapshot(collection(db, "vendas"), (snapVendas) => {
        onSnapshot(collection(db, "vouchers_pendentes"), (snapVouchers) => {
            let totalVendas = 0; let totalCusto = 0; let pendenteTotal = 0;
            const history = document.getElementById('sales-history-list'); history.innerHTML = '';
            const vouchersList = document.getElementById('vouchers-history-list'); vouchersList.innerHTML = '';

            // HISTORICO DE VENDAS E CALCULO DE LUCRO
            snapVendas.forEach(docSnap => {
                const v = docSnap.data();
                if(v.dataSimples === currentDateFilter) {
                    totalVendas += v.total;
                    totalCusto += v.custoTotal || 0; // Soma o custo real da mercadoria vendida
                    
                    const div = document.createElement('div');
                    div.className = "bg-white p-4 rounded-2xl flex justify-between border items-center shadow-sm";
                    div.innerHTML = `
                        <div class="flex-1"><p class="font-bold text-gray-800">Pedido #${v.nroPedido}</p><p class="text-xs text-gray-500">${v.cliente} | Pgto: ${v.pagamento}</p></div>
                        <div class="text-right mr-4"><p class="font-black text-green-600">R$ ${v.total.toFixed(2)}</p></div>
                        <button class="bg-red-50 text-red-500 p-2 rounded-xl btn-delete"><i class="ph ph-trash"></i></button>
                    `;
                    div.querySelector('.btn-delete').onclick = async () => { if(confirm('Excluir Venda?')) await deleteDoc(doc(db, "vendas", docSnap.id)); };
                    history.appendChild(div);
                }
            });

            // HISTÓRICO DE VOUCHERS PENDENTES
            snapVouchers.forEach(docSnap => {
                const pend = docSnap.data();
                if(pend.status === 'pendente') {
                    pendenteTotal += pend.valor;
                    const div = document.createElement('div');
                    div.className = "bg-purple-50 p-4 rounded-2xl border border-purple-100 flex justify-between items-center";
                    div.innerHTML = `
                        <div><p class="font-bold text-purple-800">${pend.colaborador}</p><p class="text-xs text-purple-500">Ref: Pedido #${pend.nroPedido}</p></div>
                        <div class="text-right mr-3"><p class="font-black text-purple-700">R$ ${pend.valor.toFixed(2)}</p></div>
                        <button class="bg-green-500 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-md btn-receber">Dar Baixa</button>
                    `;
                    // Função de Dar Baixa (Financeiro recebeu o dinheiro)
                    div.querySelector('.btn-receber').onclick = async () => {
                        if(confirm(`Confirmar recebimento de R$ ${pend.valor.toFixed(2)} de ${pend.colaborador}?`)) {
                            // Marca como pago
                            await updateDoc(doc(db, "vouchers_pendentes", docSnap.id), { status: 'pago', dataPagamento: new Date().toISOString() });
                            
                            // Restaura o saldo de voucher do colaborador!
                            const c = clients.find(cli => cli.nome === pend.colaborador);
                            if(c) {
                                const novoSaldo = (parseFloat(c.saldo_voucher || 0) + pend.valor);
                                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
                            }
                            alert('Baixa realizada com sucesso! Limite restaurado.');
                        }
                    };
                    vouchersList.appendChild(div);
                }
            });

            document.getElementById('dash-revenue').innerText = `R$ ${totalVendas.toFixed(2)}`;
            document.getElementById('dash-cost').innerText = `R$ ${totalCusto.toFixed(2)}`;
            document.getElementById('dash-profit').innerText = `R$ ${(totalVendas - totalCusto).toFixed(2)}`;
            document.getElementById('dash-vouchers').innerText = `R$ ${pendenteTotal.toFixed(2)}`;
        });
    });
}

// ==========================================
// PDV, CARRINHO E RECIBO
// ==========================================
function buildCategoryTabs() {
    const categorias = ["Todos", "Combos", ...new Set(products.map(p => p.categoria))];
    const container = document.getElementById('category-tabs');
    container.innerHTML = categorias.map(c => `<button class="px-6 py-2 rounded-xl font-bold whitespace-nowrap bg-gray-100 cat-btn" data-cat="${c}">${c}</button>`).join('');
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.replace('theme-bg', 'bg-gray-100'));
            btn.classList.replace('bg-gray-100', 'theme-bg'); renderPdv(btn.dataset.cat);
        };
    });
    renderPdv('Todos');
}

function renderPdv(filtro) {
    const grid = document.getElementById('product-grid'); grid.innerHTML = '';
    
    // Mescla Produtos e Combos para o PDV
    let catalogo = [...products, ...combos.map(c => ({...c, categoria: 'Combos', imagem: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80'}))];
    const filtered = filtro === 'Todos' ? catalogo : catalogo.filter(p => p.categoria === filtro);
    
    filtered.forEach(p => {
        const isCombo = p.isCombo;
        const badge = isCombo ? `<span class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-md">COMBO</span>` : '';
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition active:scale-95 flex flex-col relative";
        div.innerHTML = `${badge}<img src="${p.imagem}" class="w-full h-24 object-cover rounded-2xl mb-3"><p class="text-sm font-bold leading-tight mb-1 text-gray-800">${p.nome}</p><p class="theme-text font-black text-lg mt-auto">R$ ${p.preco.toFixed(2)}</p>`;
        div.onclick = () => addToCart(p); grid.appendChild(div);
    });
}

function addToCart(p) { const item = cart.find(i => i.id === p.id); if(item) item.qty++; else cart.push({...p, qty: 1}); updateCart(); }
window.removeCartItem = (id) => { cart = cart.filter(item => item.id !== id); updateCart(); }
document.getElementById('btn-clear').onclick = () => { cart = []; updateCart(); };

function updateCart() {
    const list = document.getElementById('cart-items'); list.innerHTML = ''; cartTotal = 0;
    cart.forEach(item => {
        cartTotal += item.preco * item.qty;
        list.innerHTML += `<div class="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border"><div><p class="font-bold text-gray-800 text-sm">${item.qty}x ${item.nome}</p><p class="text-xs text-gray-500">R$ ${(item.preco * item.qty).toFixed(2)}</p></div><button onclick="window.removeCartItem('${item.id}')" class="text-red-400 hover:text-red-600 p-2"><i class="ph ph-x-circle text-xl"></i></button></div>`;
    });
    document.getElementById('total').innerText = `R$ ${cartTotal.toFixed(2)}`;
}

document.getElementById('btn-checkout').onclick = async () => {
    if(!cart.length) return alert('Carrinho vazio!');
    
    const nro = Math.floor(1000 + Math.random() * 9000);
    const clienteNome = document.getElementById('pdv-cliente').value;
    const pagamento = document.getElementById('pdv-pagamento').value;
    const cpfNaNota = document.getElementById('pdv-cpf').value;
    const dataAtualStr = new Date().toISOString().split('T')[0];

    const c = clients.find(cli => cli.nome === clienteNome);

    // ====================================================
    // LÓGICA INTELIGENTE DO VOUCHER
    // ====================================================
    if (pagamento === 'Voucher') {
        if (!c || c.tipo !== 'Colaborador') return alert("Selecione um Colaborador válido para usar o Voucher!");
        
        let saldoDisponivel = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0);
        
        if (cartTotal > saldoDisponivel) {
            const diferenca = cartTotal - saldoDisponivel;
            const msg = `O saldo de benefício (R$ ${saldoDisponivel.toFixed(2)}) não é suficiente.\n\nDeseja consumir todo o saldo e registrar a diferença de R$ ${diferenca.toFixed(2)} como dívida pendente para ser cobrada depois?`;
            
            if(!confirm(msg)) return; // Se o caixa cancelar, aborta a venda.
            
            // Registra a dívida no financeiro para cobrar do colaborador depois
            await addDoc(collection(db, "vouchers_pendentes"), {
                colaborador: clienteNome,
                colaboradorId: c.id,
                valor: diferenca,
                status: 'pendente',
                nroPedido: nro,
                dataStr: dataAtualStr,
                timestamp: serverTimestamp()
            });

            // Zera o saldo do colaborador
            await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: 0 });

        } else {
            // Tem saldo suficiente, só desconta normalmente
            await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: saldoDisponivel - cartTotal });
        }
    }

    // Calcula o Custo Total dos Itens (Para o Dashboard Financeiro)
    let custoDaVenda = 0;
    cart.forEach(item => {
        if (item.isCombo) {
            item.itens.forEach(sub => custoDaVenda += (sub.custo || 0) * item.qty);
        } else {
            custoDaVenda += (item.custo || 0) * item.qty;
        }
    });

    // 1. Salvar Venda
    await addDoc(collection(db, "vendas"), {
        nroPedido: nro, total: cartTotal, custoTotal: custoDaVenda, cliente: clienteNome, pagamento: pagamento, cpf: cpfNaNota,
        data: serverTimestamp(), dataSimples: dataAtualStr, itens: cart.map(i => ({ nome: i.nome, qtd: i.qty, preco: i.preco }))
    });

    // 2. Baixa Estoque (Trata produtos normais e componentes de combos)
    for(const item of cart) {
        if (item.isCombo) {
            for(const sub of item.itens) {
                const p = products.find(prod => prod.id === sub.id);
                if(p) await updateDoc(doc(db, "produtos", p.id), { estoque_total: (p.estoque_total || p.estoque) - item.qty });
            }
        } else {
            const p = products.find(prod => prod.id === item.id);
            if(p) await updateDoc(doc(db, "produtos", p.id), { estoque_total: (p.estoque_total || p.estoque) - item.qty });
        }
    }

    // 3. Imprimir
    let cupomItems = '';
    cart.forEach(i => { cupomItems += `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${i.qty}x ${i.nome}</span><span>${(i.preco * i.qty).toFixed(2)}</span></div>`; });
    
    document.getElementById('print-section').innerHTML = `
        <div style="text-align:center; margin-bottom: 10px;">
            <h2 style="margin:0; font-size:18px;">${appConfig.nome || 'Matsucafe'}</h2><p style="margin:0; font-size:12px;">${appConfig.cnpj || ''}</p><p style="margin:0; font-size:12px;">${appConfig.endereco || ''}</p>
            <hr style="border-top:1px dashed #000; margin:5px 0;">
            <p style="margin:0; font-size:12px;">Pedido #${nro}</p><p style="margin:0; font-size:12px;">Cliente: ${clienteNome}</p><p style="margin:0; font-size:12px;">Pgto: ${pagamento}</p>
        </div>
        <hr style="border-top:1px dashed #000; margin:10px 0;">
        <div style="font-size:12px;">${cupomItems}</div>
        <hr style="border-top:1px dashed #000; margin:10px 0;">
        <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;"><span>TOTAL</span><span>R$ ${cartTotal.toFixed(2)}</span></div>
        <br><br>
    `;
    cart = []; updateCart(); window.print();
};

// ==========================================
// FUNÇÕES GLOBAIS DE MODAL (Evitam o Erro "not a function")
// ==========================================
window.closeModals = () => {
    document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('input:not([type="date"])').forEach(i => i.value = '');
};

window.openProductModal = (p = null) => {
    document.getElementById('modal-produto').classList.remove('hidden');
    document.getElementById('edit-id').value = p ? p.id : '';
    document.getElementById('prod-estoque-lote').value = '';
    document.getElementById('prod-entrada').value = new Date().toISOString().split('T')[0];
    document.getElementById('prod-validade').value = '';

    if(p) {
        document.getElementById('modal-title').innerText = "Editar Produto";
        document.getElementById('modal-subtitle').classList.remove('hidden');
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('prod-venda').value = p.preco; document.getElementById('prod-custo').value = p.custo;
        document.getElementById('prod-imagem').value = p.imagem;
    } else {
        document.getElementById('modal-title').innerText = "Novo Produto";
        document.getElementById('modal-subtitle').classList.add('hidden');
    }
};

window.openClientModal = (c = null) => {
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('cli-id').value = c ? c.id : '';
    if(c) {
        document.getElementById('cli-tipo').value = c.tipo; document.getElementById('cli-nome').value = c.nome;
        document.getElementById('cli-telefone').value = c.telefone; document.getElementById('cli-voucher').value = c.voucher || '';
    } else { document.getElementById('cli-tipo').value = 'Cliente'; }
    window.toggleVoucher();
};

window.toggleVoucher = () => {
    const tipo = document.getElementById('cli-tipo').value;
    const container = document.getElementById('cli-voucher-container');
    if (tipo === 'Colaborador') {
        container.classList.remove('hidden');
        container.classList.add('block');
    } else {
        container.classList.add('hidden');
        container.classList.remove('block');
    }
};

window.openHistoryModal = (clienteNome) => {
    currentClientHistory = clienteNome;
    document.getElementById('hist-nome').innerText = clienteNome;
    document.getElementById('modal-historico').classList.remove('hidden');
    window.loadClientHistory();
};

window.openComboModal = () => {
    document.getElementById('modal-combo').classList.remove('hidden');
    const lista = document.getElementById('combo-produtos-lista');
    lista.innerHTML = '';
    products.forEach(p => {
        lista.innerHTML += `
            <label class="flex items-center gap-3 bg-white p-2 border rounded-xl cursor-pointer hover:bg-gray-100">
                <input type="checkbox" value="${p.id}" class="combo-prod-check w-5 h-5 accent-green-600">
                <span class="font-bold text-sm text-gray-700">${p.nome} (Custo: R$ ${(p.custo || 0).toFixed(2)})</span>
            </label>
        `;
    });
};
