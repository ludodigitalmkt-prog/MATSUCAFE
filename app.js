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
let appConfig = { nome: "Matsucafe", cnpj: "", endereco: "", telefone: "", msg: "Obrigado e volte sempre!", logo: "" };

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
    const tab = document.getElementById(tabId);
    if(tab) tab.classList.remove('hidden');
}

['nav-pdv', 'nav-crm', 'nav-menu', 'nav-combos', 'nav-quebras', 'nav-financeiro', 'nav-settings'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => switchTab(id.replace('nav-', 'tab-')));
});

const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const isAdmin = user.email === ADMIN_EMAIL;
        document.querySelectorAll('.admin-only').forEach(btn => btn.classList.toggle('hidden', !isAdmin));
        loadSettings(); loadProducts(); loadCombos(); loadCRM(); loadQuebras(); initDashboard();
    } else { document.getElementById('login-screen').style.display = 'flex'; }
});

const loginForm = document.getElementById('login-form');
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
            .catch(() => document.getElementById('login-error').classList.remove('hidden'));
    });
}

// ==========================================
// CONFIGURAÇÕES (Com alteração da Logo do Menu)
// ==========================================
function loadSettings() {
    onSnapshot(doc(db, "config", "loja"), (docSnap) => {
        if(docSnap.exists()) {
            appConfig = docSnap.data();
            if(document.getElementById('cfg-nome')) document.getElementById('cfg-nome').value = appConfig.nome || '';
            if(document.getElementById('cfg-cnpj')) document.getElementById('cfg-cnpj').value = appConfig.cnpj || '';
            if(document.getElementById('cfg-endereco')) document.getElementById('cfg-endereco').value = appConfig.endereco || '';
            if(document.getElementById('cfg-telefone')) document.getElementById('cfg-telefone').value = appConfig.telefone || '';
            if(document.getElementById('cfg-msg')) document.getElementById('cfg-msg').value = appConfig.msg || '';
            if(document.getElementById('cfg-logo')) document.getElementById('cfg-logo').value = appConfig.logo || '';
            
            // Atualiza a logo no menu lateral
            if(document.getElementById('sidebar-logo')) {
                document.getElementById('sidebar-logo').src = appConfig.logo || 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=100&q=80';
            }
        }
    });
}

const btnSaveCfg = document.getElementById('btn-save-cfg');
if(btnSaveCfg) {
    btnSaveCfg.onclick = async () => {
        await setDoc(doc(db, "config", "loja"), {
            nome: document.getElementById('cfg-nome').value, 
            cnpj: document.getElementById('cfg-cnpj').value,
            endereco: document.getElementById('cfg-endereco').value, 
            telefone: document.getElementById('cfg-telefone').value,
            msg: document.getElementById('cfg-msg').value,
            logo: document.getElementById('cfg-logo').value
        });
        alert("Configurações salvas com sucesso!");
    };
}

// ==========================================
// CRM
// ==========================================
function loadCRM() {
    onSnapshot(collection(db, "clientes"), (snapshot) => {
        clients = []; snapshot.forEach(d => clients.push({ id: d.id, ...d.data() }));
        renderCRM(); updatePDVClients();
    });
}

function updatePDVClients() {
    const pdvSelect = document.getElementById('pdv-cliente');
    if(!pdvSelect) return;
    pdvSelect.innerHTML = '<option value="Avulso">Cliente Avulso</option>';
    clients.forEach(c => pdvSelect.innerHTML += `<option value="${c.nome}">${c.nome} (${c.tipo})</option>`);
}

const pdvClienteSelect = document.getElementById('pdv-cliente');
if(pdvClienteSelect) {
    pdvClienteSelect.addEventListener('change', (e) => {
        const nome = e.target.value;
        const c = clients.find(cli => cli.nome === nome);
        const infoDiv = document.getElementById('pdv-voucher-info');
        if(c && c.tipo === 'Colaborador') {
            const saldo = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0);
            document.getElementById('pdv-voucher-saldo').innerText = `R$ ${saldo.toFixed(2)}`;
            infoDiv.classList.remove('hidden');
        } else {
            infoDiv.classList.add('hidden');
        }
    });
}

function renderCRM(searchTerm = '') {
    const list = document.getElementById('crm-list'); 
    if(!list) return;
    list.innerHTML = '';
    const filtered = clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    
    filtered.forEach(c => {
        const isColab = c.tipo === 'Colaborador';
        const limiteReal = parseFloat(c.voucher || 0).toFixed(2);
        const saldoReal = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0).toFixed(2);
        
        const limitInfo = isColab ? `<br><span class="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md border border-purple-100 mt-1 inline-block">Limite: R$ ${limiteReal} | Restante: R$ ${saldoReal}</span>` : '';
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer";
        tr.innerHTML = `
            <td class="p-4 font-black text-gray-800 uppercase" onclick="window.openHistoryModal('${c.nome}')">${c.nome}</td>
            <td class="p-4" onclick="window.openHistoryModal('${c.nome}')"><span class="${isColab ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'} px-3 py-1 rounded-lg text-xs font-black shadow-sm">${c.tipo}</span>${limitInfo}</td>
            <td class="p-4 text-gray-500 font-bold" onclick="window.openHistoryModal('${c.nome}')">${c.telefone || '---'}</td>
            <td class="p-4 text-right flex justify-end gap-2">
                <button class="bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-edit"><i class="ph ph-pencil-simple text-lg"></i></button>
                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit').onclick = () => window.openClientModal(c);
        tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir contato?')) await deleteDoc(doc(db, "clientes", c.id)); };
        list.appendChild(tr);
    });
}

const searchCliente = document.getElementById('search-cliente');
if(searchCliente) searchCliente.addEventListener('input', (e) => renderCRM(e.target.value));

const btnSaveClient = document.getElementById('btn-save-client');
if(btnSaveClient) {
    btnSaveClient.onclick = async () => {
        const id = document.getElementById('cli-id').value;
        const isColab = document.getElementById('cli-tipo').value === 'Colaborador';
        const valorVoucher = parseFloat(document.getElementById('cli-voucher').value || 0);

        const data = {
            nome: document.getElementById('cli-nome').value, 
            telefone: document.getElementById('cli-telefone').value,
            tipo: document.getElementById('cli-tipo').value, 
            voucher: isColab ? valorVoucher : 0
        };
        
        if(!id) data.saldo_voucher = data.voucher;

        if(id) await updateDoc(doc(db, "clientes", id), data); else await addDoc(collection(db, "clientes"), data);
        window.closeModals();
    };
}

window.loadClientHistory = async () => {
    if(!currentClientHistory) return;
    const inicio = document.getElementById('hist-data-inicio').value;
    const fim = document.getElementById('hist-data-fim').value;
    const q = query(collection(db, "vendas"), where("cliente", "==", currentClientHistory));
    const snap = await getDocs(q);
    
    let total = 0; const lista = document.getElementById('hist-lista'); 
    if(!lista) return;
    lista.innerHTML = '';
    
    snap.forEach(doc => {
        const v = doc.data();
        if(inicio && fim && (v.dataSimples < inicio || v.dataSimples > fim)) return; 
        
        total += v.total;
        lista.innerHTML += `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm flex justify-between items-center shadow-sm">
                <div><p class="font-black text-gray-800">Pedido #${v.nroPedido}</p><p class="text-xs text-gray-500 font-bold mt-1">${v.dataSimples.split('-').reverse().join('/')} - Pgto: ${v.pagamento}</p></div>
                <div class="font-black text-green-600 text-lg">R$ ${v.total.toFixed(2)}</div>
            </div>
        `;
    });
    document.getElementById('hist-total').innerText = `R$ ${total.toFixed(2)}`;
    if(lista.innerHTML === '') lista.innerHTML = '<p class="text-gray-400 text-center text-sm p-4 font-bold">Nenhuma compra encontrada no período.</p>';
};

// ==========================================
// ESTOQUE COM LOTES 
// ==========================================
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = []; 
        const list = document.getElementById('admin-product-list'); 
        const quebraSelect = document.getElementById('quebra-produto');
        
        if(list) list.innerHTML = ''; 
        if(quebraSelect) quebraSelect.innerHTML = '<option value="">Selecione o Produto</option>';
        
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

                if (diffDias < 0) statusVencimentoHtml = `<span class="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-black animate-pulse shadow-sm">VENCIDO (${dataFormatada})</span>`;
                else if (diffDias <= 7) statusVencimentoHtml = `<span class="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-black shadow-sm">Alerta: ${diffDias} dias (${dataFormatada})</span>`;
                else if (diffDias <= 30) statusVencimentoHtml = `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">Vence em ${diffDias} dias</span>`;
                else statusVencimentoHtml = `<span class="text-green-600 font-bold">${dataFormatada}</span>`;
            }

            if(list) {
                const tr = document.createElement('tr'); 
                tr.className = "border-b border-gray-50 hover:bg-gray-50 transition";
                tr.innerHTML = `
                    <td class="p-5 flex items-center gap-3"><img src="${p.imagem}" class="w-12 h-12 rounded-xl object-contain bg-white shadow-sm border border-gray-100 p-1">
                        <div><span class="font-black text-gray-800 block">${p.nome}</span><span class="text-[10px] text-gray-400 font-bold uppercase">${(p.lotes || []).length} lote(s)</span></div>
                    </td>
                    <td class="p-5"><span class="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold border border-gray-200">${p.categoria}</span></td>
                    <td class="p-5 font-black text-lg ${totalEstoque <= 5 ? 'text-red-500' : 'text-blue-600'}">${totalEstoque} un</td>
                    <td class="p-5">${statusVencimentoHtml}</td>
                    <td class="p-5 text-right flex justify-end gap-2">
                        <button class="bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-add-lote" title="Add Lote/Editar"><i class="ph ph-pencil-simple text-lg"></i></button> 
                        <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>
                    </td>
                `;
                tr.querySelector('.btn-add-lote').onclick = () => window.openProductModal(p);
                tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir produto e lotes permanentemente?')) await deleteDoc(doc(db, "produtos", p.id)); };
                list.appendChild(tr); 
            }
            if(quebraSelect) quebraSelect.innerHTML += `<option value="${p.id}">${p.nome} (${totalEstoque} disp.)</option>`;
        });
        buildCategoryTabs();
    });
}

const btnSaveProduct = document.getElementById('btn-save-product');
if(btnSaveProduct) {
    btnSaveProduct.onclick = async () => {
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
}

// ==========================================
// COMBOS
// ==========================================
async function loadCombos() {
    onSnapshot(collection(db, "combos"), (snapshot) => {
        combos = []; const list = document.getElementById('combos-list'); 
        if(!list) return;
        list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const c = { id: docSnap.id, ...docSnap.data() }; combos.push(c);
            const itemsText = c.itens.map(i => `${i.nome}`).join(' + ');
            const imgHtml = c.imagem ? `<img src="${c.imagem}" class="w-14 h-14 rounded-xl object-contain border border-gray-100 p-1 mr-4 bg-gray-50 shadow-sm">` : '';
            
            const div = document.createElement('div');
            div.className = "p-5 border border-gray-100 rounded-2xl flex justify-between items-center hover:shadow-lg transition bg-white shadow-sm";
            div.innerHTML = `
                <div class="flex items-center">
                    ${imgHtml}
                    <div><h4 class="font-black text-gray-800 text-lg">${c.nome}</h4><p class="text-xs text-gray-500 font-bold uppercase mt-1">${itemsText}</p><p class="text-green-600 font-black mt-2 text-xl">R$ ${c.preco.toFixed(2)}</p></div>
                </div>
                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-xl"></i></button>
            `;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir Combo?')) await deleteDoc(doc(db, "combos", c.id)); };
            list.appendChild(div);
        });
        buildCategoryTabs();
    });
}

const btnSaveCombo = document.getElementById('btn-save-combo');
if(btnSaveCombo) {
    btnSaveCombo.onclick = async () => {
        const nome = document.getElementById('combo-nome').value;
        const imagem = document.getElementById('combo-imagem').value; 
        const preco = parseFloat(document.getElementById('combo-preco').value || 0);
        const checkboxes = document.querySelectorAll('.combo-prod-check:checked');
        if(!nome || preco <= 0 || checkboxes.length === 0) return alert('Preencha nome, preço e selecione produtos!');
        
        const itensSelecionados = Array.from(checkboxes).map(cb => {
            const prod = products.find(p => p.id === cb.value);
            return { id: prod.id, nome: prod.nome, custo: prod.custo };
        });

        await addDoc(collection(db, "combos"), { nome, imagem, preco, itens: itensSelecionados, isCombo: true });
        window.closeModals();
    };
}

// ==========================================
// QUEBRAS (Reaproveitando a Baixa de Lotes)
// ==========================================
async function loadQuebras() {
    onSnapshot(collection(db, "quebras"), (snapshot) => {
        const list = document.getElementById('quebra-list'); 
        if(!list) return;
        list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const q = docSnap.data(); const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl flex justify-between items-center border border-red-100 shadow-sm";
            div.innerHTML = `<div><p class="font-black text-red-600 uppercase">${q.produtoNome} x${q.qtd}</p><p class="text-xs font-bold text-gray-500 mt-1">${q.motivo} | Perda: R$ ${(q.valorPerda || 0).toFixed(2)}</p></div><button class="bg-gray-100 hover:bg-red-500 hover:text-white transition text-gray-400 p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>`;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Apagar registro de quebra?')) await deleteDoc(doc(db, "quebras", docSnap.id)); };
            list.appendChild(div);
        });
    });
}

const btnAddQuebra = document.getElementById('btn-add-quebra');
if(btnAddQuebra) {
    btnAddQuebra.onclick = async () => {
        const pId = document.getElementById('quebra-produto').value; 
        const qty = parseInt(document.getElementById('quebra-qty').value);
        const p = products.find(prod => prod.id === pId);
        
        if(!p || !qty) return alert("Preencha corretamente!");
        
        const estoqueAtual = p.estoque_total !== undefined ? p.estoque_total : p.estoque;
        if(qty > estoqueAtual) return alert("Quantidade de quebra maior que o estoque disponível!");

        await addDoc(collection(db, "quebras"), { 
            produtoId: pId, produtoNome: p.nome, qtd: qty, motivo: document.getElementById('quebra-motivo').value || '-', 
            valorPerda: p.custo * qty, data: serverTimestamp(), dataSimples: new Date().toISOString().split('T')[0] 
        });

        await baixarEstoqueFIFO(p.id, qty);
        
        document.getElementById('quebra-qty').value = ''; document.getElementById('quebra-motivo').value = '';
        alert("Quebra registrada e estoque deduzido!");
    };
}

// ==========================================
// FUNÇÃO CENTRAL DE BAIXA DE ESTOQUE (FIFO)
// ==========================================
async function baixarEstoqueFIFO(produtoId, quantidadeParaBaixar) {
    const p = products.find(prod => prod.id === produtoId);
    if(!p) return;

    let lotesAtuais = p.lotes || [];
    let qtdRestante = quantidadeParaBaixar;
    
    // Organiza para tirar do lote que vence primeiro
    lotesAtuais.sort((a, b) => new Date(a.validade) - new Date(b.validade));
    
    for (let lote of lotesAtuais) {
        if (qtdRestante <= 0) break;
        if (lote.quantidade > 0) {
            if (lote.quantidade >= qtdRestante) {
                lote.quantidade -= qtdRestante;
                qtdRestante = 0;
            } else {
                qtdRestante -= lote.quantidade;
                lote.quantidade = 0;
            }
        }
    }
    const novoEstoqueTotal = lotesAtuais.reduce((acc, l) => acc + l.quantidade, 0);
    await updateDoc(doc(db, "produtos", p.id), { lotes: lotesAtuais, estoque_total: novoEstoqueTotal });
}

// ==========================================
// FINANCEIRO AVANÇADO (INJETANDO VOUCHER PAGO)
// ==========================================
const filtroData = document.getElementById('filtro-data');
if(filtroData) {
    filtroData.value = currentDateFilter;
    filtroData.onchange = (e) => { currentDateFilter = e.target.value; initDashboard(); };
}

function initDashboard() {
    onSnapshot(collection(db, "vendas"), (snapVendas) => {
        onSnapshot(collection(db, "vouchers_pendentes"), (snapVouchers) => {
            let totalVendas = 0; let totalCusto = 0; let pendenteTotal = 0;
            const history = document.getElementById('sales-history-list'); 
            const vouchersList = document.getElementById('vouchers-history-list'); 
            
            if(history) history.innerHTML = '';
            if(vouchersList) vouchersList.innerHTML = '';

            snapVendas.forEach(docSnap => {
                const v = docSnap.data();
                if(v.dataSimples === currentDateFilter) {
                    totalVendas += v.total;
                    totalCusto += v.custoTotal || 0; 
                    
                    if(history) {
                        const div = document.createElement('div');
                        div.className = "bg-white p-5 rounded-[1.5rem] border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition";
                        div.innerHTML = `
                            <div class="flex-1"><p class="font-black text-gray-800 text-lg">${v.isVoucherPgto ? 'Entrada Voucher' : `Pedido #${v.nroPedido}`}</p><p class="text-xs text-gray-500 font-bold mt-1">${v.cliente} | Pgto: ${v.pagamento}</p></div>
                            <div class="text-right mr-5"><p class="font-black text-green-600 text-xl">R$ ${v.total.toFixed(2)}</p></div>
                            <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-delete"><i class="ph ph-trash text-lg"></i></button>
                        `;
                        div.querySelector('.btn-delete').onclick = async () => { if(confirm('Atenção: Excluir esta transação? O valor sumirá do financeiro.')) await deleteDoc(doc(db, "vendas", docSnap.id)); };
                        history.appendChild(div);
                    }
                }
            });

            snapVouchers.forEach(docSnap => {
                const pend = docSnap.data();
                if(pend.status === 'pendente') {
                    pendenteTotal += pend.valor;
                    if(vouchersList) {
                        const div = document.createElement('div');
                        div.className = "bg-purple-50 p-5 rounded-[1.5rem] border border-purple-100 flex justify-between items-center shadow-sm hover:shadow-md transition";
                        div.innerHTML = `
                            <div><p class="font-black text-purple-800 text-lg">${pend.colaborador}</p><p class="text-xs text-purple-500 font-bold mt-1">Ref: Pedido #${pend.nroPedido}</p></div>
                            <div class="text-right mr-4"><p class="font-black text-purple-700 text-xl">R$ ${pend.valor.toFixed(2)}</p></div>
                            <button class="bg-green-500 hover:bg-green-600 transition text-white font-black text-sm px-4 py-3 rounded-xl shadow-md btn-receber"><i class="ph ph-check-circle"></i> Receber</button>
                        `;
                        div.querySelector('.btn-receber').onclick = async () => {
                            if(confirm(`Confirmar recebimento financeiro de R$ ${pend.valor.toFixed(2)} referente a ${pend.colaborador}? O valor será injetado no caixa de hoje.`)) {
                                
                                // 1. Marca o voucher como pago
                                await updateDoc(doc(db, "vouchers_pendentes", docSnap.id), { status: 'pago', dataPagamento: new Date().toISOString() });
                                
                                // 2. Devolve para o colaborador APENAS o valor que era do limite dele (Ignorando valores que foram para pendura)
                                const c = clients.find(cli => cli.nome === pend.colaborador);
                                if(c) {
                                    const novoSaldo = parseFloat(c.saldo_voucher || 0) + parseFloat(pend.valorRestaurar || pend.valor);
                                    await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
                                }

                                // 3. INJETA O DINHEIRO NO CAIXA DO DIA ATUAL
                                const nroPagamento = Math.floor(1000 + Math.random() * 9000);
                                await addDoc(collection(db, "vendas"), {
                                    nroPedido: `PGTO-${nroPagamento}`, 
                                    total: pend.valor, 
                                    custoTotal: 0, // O custo já foi debitado no dia da venda do produto
                                    cliente: pend.colaborador, 
                                    pagamento: 'Recebimento Voucher', 
                                    cpf: '',
                                    complemento: 0,
                                    isVoucherPgto: true,
                                    data: serverTimestamp(), 
                                    dataSimples: new Date().toISOString().split('T')[0], // Puxa pro dia que deu baixa
                                    itens: [{nome: `Pgto Voucher (Ref. #${pend.nroPedido})`, qty: 1, preco: pend.valor}]
                                });

                                alert('Baixa realizada! O valor entrou no caixa e o limite dele foi restaurado.');
                            }
                        };
                        vouchersList.appendChild(div);
                    }
                }
            });

            if(document.getElementById('dash-revenue')) document.getElementById('dash-revenue').innerText = `R$ ${totalVendas.toFixed(2)}`;
            if(document.getElementById('dash-cost')) document.getElementById('dash-cost').innerText = `R$ ${totalCusto.toFixed(2)}`;
            if(document.getElementById('dash-profit')) document.getElementById('dash-profit').innerText = `R$ ${(totalVendas - totalCusto).toFixed(2)}`;
            if(document.getElementById('dash-vouchers')) document.getElementById('dash-vouchers').innerText = `R$ ${pendenteTotal.toFixed(2)}`;
        });
    });
}

// ==========================================
// PDV - EXIBINDO ESTOQUE E BLOQUEANDO ZERADOS
// ==========================================
function buildCategoryTabs() {
    const categorias = ["Todos", "Combos", ...new Set(products.map(p => p.categoria))];
    const container = document.getElementById('category-tabs');
    if(!container) return;
    container.innerHTML = categorias.map(c => `<button class="px-6 py-2 rounded-xl font-bold uppercase text-sm whitespace-nowrap bg-gray-100 text-gray-500 shadow-sm transition cat-btn" data-cat="${c}">${c}</button>`).join('');
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => { b.classList.replace('theme-bg', 'bg-gray-100'); b.classList.replace('text-white', 'text-gray-500'); });
            btn.classList.replace('bg-gray-100', 'theme-bg'); btn.classList.replace('text-gray-500', 'text-white'); renderPdv(btn.dataset.cat);
        };
    });
    renderPdv('Todos');
}

function renderPdv(filtro) {
    const grid = document.getElementById('product-grid'); 
    if(!grid) return;
    grid.innerHTML = '';
    
    let catalogo = [...products, ...combos.map(c => ({...c, categoria: 'Combos', imagem: c.imagem || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80'}))];
    const filtered = filtro === 'Todos' ? catalogo : catalogo.filter(p => p.categoria === filtro);
    
    filtered.forEach(p => {
        const isCombo = p.isCombo;
        let estoqueDisplay = '';
        let opacityClass = '';
        let bloqueado = false;

        // Lógica Visual do Card Fosco e Esgotado
        if(!isCombo) {
            const totalEstoque = (p.lotes || []).reduce((acc, l) => acc + l.quantidade, 0);
            if (totalEstoque <= 0) {
                estoqueDisplay = `<span class="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-md uppercase mt-1 inline-block border border-red-200 shadow-sm">ESGOTADO</span>`;
                opacityClass = 'opacity-40 grayscale pointer-events-none';
                bloqueado = true;
            } else {
                estoqueDisplay = `<span class="text-[10px] font-bold text-gray-500 mt-1 inline-block">${totalEstoque} un. disponíveis</span>`;
            }
        }

        const badge = isCombo ? `<span class="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-md shadow-md">COMBO</span>` : '';
        const div = document.createElement('div');
        
        div.className = `bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col relative group transition ${opacityClass} ${bloqueado ? '' : 'cursor-pointer hover:shadow-lg hover:-translate-y-1'}`;
        div.innerHTML = `${badge}<img src="${p.imagem}" class="w-full h-36 object-contain bg-gray-50 rounded-2xl mb-4 p-2 transition ${bloqueado ? '' : 'group-hover:scale-105'}">
                         <p class="text-sm font-black leading-tight mb-1 text-gray-800">${p.nome}</p>
                         ${estoqueDisplay}
                         <p class="theme-text font-black text-xl mt-auto pt-3">R$ ${p.preco.toFixed(2)}</p>`;
        
        if(!bloqueado) {
            div.onclick = () => addToCart(p); 
        }
        grid.appendChild(div);
    });
}

function addToCart(p) { 
    if(!p.isCombo) {
        const totalEstoque = (p.lotes || []).reduce((acc, l) => acc + l.quantidade, 0);
        const currentInCart = cart.find(i => i.id === p.id)?.qty || 0;
        if (currentInCart + 1 > totalEstoque) return alert('Você não tem mais estoque suficiente deste produto para adicionar ao carrinho!');
    }
    
    const item = cart.find(i => i.id === p.id); 
    if(item) item.qty++; else cart.push({...p, qty: 1}); 
    updateCart(); 
}

window.removeCartItem = (id) => { cart = cart.filter(item => item.id !== id); updateCart(); }
if(document.getElementById('btn-clear')) document.getElementById('btn-clear').onclick = () => { cart = []; updateCart(); };

function updateCart() {
    const list = document.getElementById('cart-items'); 
    if(!list) return;
    list.innerHTML = ''; cartTotal = 0;
    cart.forEach(item => {
        cartTotal += item.preco * item.qty;
        list.innerHTML += `<div class="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-2"><div class="flex-1"><p class="font-black text-gray-800 text-sm leading-tight">${item.qty}x ${item.nome}</p><p class="text-xs text-gray-500 font-bold mt-1">R$ ${(item.preco * item.qty).toFixed(2)}</p></div><button onclick="window.removeCartItem('${item.id}')" class="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-xl transition"><i class="ph ph-x-circle text-lg"></i></button></div>`;
    });
    if(document.getElementById('total')) document.getElementById('total').innerText = `R$ ${cartTotal.toFixed(2)}`;
}

// ==========================================
// CHECKOUT COM VOUCHER MELHORADO
// ==========================================
const btnCheckout = document.getElementById('btn-checkout');
if(btnCheckout) {
    btnCheckout.onclick = async () => {
        if(!cart.length) return alert('Carrinho vazio!');
        
        const nro = Math.floor(1000 + Math.random() * 9000);
        const clienteNome = document.getElementById('pdv-cliente').value;
        let pagamento = document.getElementById('pdv-pagamento').value;
        const cpfNaNota = document.getElementById('pdv-cpf').value;
        const dataAtualStr = new Date().toISOString().split('T')[0];

        const c = clients.find(cli => cli.nome === clienteNome);
        let valorPagoNaDiferenca = 0;
        let formaPagamentoComplementar = '';

        if (pagamento === 'Voucher') {
            if (!c || c.tipo !== 'Colaborador') return alert("Selecione um Colaborador válido para usar o Voucher!");
            
            let saldoDisponivel = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0);
            let valorDaDiferencaPendura = 0;
            let valorVoucherUsado = 0;
            
            if (cartTotal > saldoDisponivel) {
                const diferenca = cartTotal - saldoDisponivel;
                
                let resposta = prompt(`O saldo de benefício (R$ ${saldoDisponivel.toFixed(2)}) não é suficiente.\nFalta R$ ${diferenca.toFixed(2)}.\n\nDigite a forma de pagamento (PIX, Dinheiro, Cartao) ou digite 'Pendura' para lançar a diferença no fechamento do mês:`);
                
                if (resposta === null || resposta.trim() === '') return alert('Venda cancelada! Forma de pagamento não informada.');

                formaPagamentoComplementar = resposta.trim();
                pagamento = `Voucher + ${formaPagamentoComplementar}`;
                valorVoucherUsado = saldoDisponivel; 

                if (formaPagamentoComplementar.toLowerCase() === 'pendura') {
                    valorDaDiferencaPendura = diferenca;
                } else {
                    valorPagoNaDiferenca = diferenca;
                }
                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: 0 });

            } else {
                valorVoucherUsado = cartTotal;
                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: saldoDisponivel - cartTotal });
            }

            // MÁGICA: Registra TODO o voucher usado nas contas a receber (para cobrar do financeiro depois)
            const totalParaOFinanceiroCobrar = valorVoucherUsado + valorDaDiferencaPendura;
            if (totalParaOFinanceiroCobrar > 0) {
                await addDoc(collection(db, "vouchers_pendentes"), {
                    colaborador: clienteNome, 
                    colaboradorId: c.id, 
                    valor: totalParaOFinanceiroCobrar, 
                    valorRestaurar: valorVoucherUsado, // Restaura só o que era limite dele
                    status: 'pendente', 
                    nroPedido: nro, 
                    dataStr: dataAtualStr, 
                    timestamp: serverTimestamp()
                });
            }
        }

        let custoDaVenda = 0;
        cart.forEach(item => {
            if (item.isCombo) {
                item.itens.forEach(sub => custoDaVenda += (sub.custo || 0) * item.qty);
            } else {
                custoDaVenda += (item.custo || 0) * item.qty;
            }
        });

        await addDoc(collection(db, "vendas"), {
            nroPedido: nro, total: cartTotal, custoTotal: custoDaVenda, 
            cliente: clienteNome, pagamento: pagamento, cpf: cpfNaNota,
            complemento: valorPagoNaDiferenca, isVoucherPgto: false,
            data: serverTimestamp(), dataSimples: dataAtualStr, itens: cart.map(i => ({ nome: i.nome, qtd: i.qty, preco: i.preco }))
        });

        // MÁGICA: Baixa de Estoque Real no Lote
        for(const item of cart) {
            if (item.isCombo) {
                for(const sub of item.itens) {
                    await baixarEstoqueFIFO(sub.id, item.qty);
                }
            } else {
                await baixarEstoqueFIFO(item.id, item.qty);
            }
        }

        let cupomItems = '';
        cart.forEach(i => { cupomItems += `<div class="receipt-item"><span>${i.qty}x ${i.nome}</span><span>R$ ${(i.preco * i.qty).toFixed(2)}</span></div>`; });
        const logoHtml = appConfig.logo ? `<img src="${appConfig.logo}" class="receipt-logo">` : '';

        const printSec = document.getElementById('print-section');
        if(printSec) {
            printSec.innerHTML = `
                <div class="receipt-header">
                    ${logoHtml}
                    <h2 class="receipt-title">${appConfig.nome || 'Matsucafe'}</h2>
                    <p class="receipt-info">CNPJ: ${appConfig.cnpj || 'Não informado'}</p>
                    <p class="receipt-info">${appConfig.endereco || ''}</p>
                    <p class="receipt-info">${appConfig.telefone || ''}</p>
                </div>
                <div class="receipt-divider"></div>
                <div style="text-align: left;">
                    <p class="receipt-info"><strong>Pedido:</strong> #${nro}</p>
                    <p class="receipt-info"><strong>Data:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                    <p class="receipt-info"><strong>Cliente:</strong> ${clienteNome}</p>
                    ${cpfNaNota ? `<p class="receipt-info"><strong>CPF:</strong> ${cpfNaNota}</p>` : ''}
                    <p class="receipt-info"><strong>Pgto:</strong> ${pagamento}</p>
                </div>
                <div class="receipt-divider"></div>
                <div>${cupomItems}</div>
                <div class="receipt-divider"></div>
                <div class="receipt-total"><span>TOTAL</span><span>R$ ${cartTotal.toFixed(2)}</span></div>
                <div class="receipt-footer"><p>${appConfig.msg || 'Obrigado e volte sempre!'}</p></div>
                <br>
            `;
            setTimeout(() => { window.print(); }, 300);
        }
        cart = []; updateCart(); document.getElementById('pdv-cpf').value = '';
    };
}

// Impressão do Relatório Financeiro
const btnPrintDay = document.getElementById('btn-print-day');
if(btnPrintDay) {
    btnPrintDay.onclick = () => {
        const printSec = document.getElementById('print-section');
        if(!printSec) return alert("Erro: Container de impressão não encontrado.");
        
        printSec.innerHTML = `
            <div class="receipt-header">
                <h2 class="receipt-title">FECHAMENTO CAIXA</h2>
                <p class="receipt-info"><strong>DATA:</strong> ${currentDateFilter.split('-').reverse().join('/')}</p>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-item"><span>ENTRADAS BRUTAS:</span><span>${document.getElementById('dash-revenue').innerText}</span></div>
            <div class="receipt-item"><span>CUSTO (MERCADORIA):</span><span>${document.getElementById('dash-cost').innerText}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-total"><span>LUCRO LÍQUIDO:</span><span>${document.getElementById('dash-profit').innerText}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-item" style="margin-top: 15px;"><span>VOUCHERS PENDENTES:</span><span>${document.getElementById('dash-vouchers').innerText}</span></div>
            <div class="receipt-footer" style="margin-top:40px;">
                <p>___________________________________</p>
                <p style="font-weight: bold; margin-top:5px;">VISTO GERÊNCIA</p>
            </div>
        `;
        setTimeout(() => { window.print(); }, 300);
    };
}

// ==========================================
// FUNÇÕES GLOBAIS DE MODAL E UI
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
        document.getElementById('modal-title').innerText = "Editar Produto Base";
        if(document.getElementById('modal-subtitle')) document.getElementById('modal-subtitle').classList.remove('hidden');
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('prod-venda').value = p.preco; document.getElementById('prod-custo').value = p.custo;
        document.getElementById('prod-imagem').value = p.imagem;
    } else {
        document.getElementById('modal-title').innerText = "Novo Produto";
        if(document.getElementById('modal-subtitle')) document.getElementById('modal-subtitle').classList.add('hidden');
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
        container.classList.remove('hidden'); container.classList.add('block');
    } else {
        container.classList.add('hidden'); container.classList.remove('block');
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
            <label class="flex items-center gap-3 bg-white p-3 border rounded-xl cursor-pointer hover:bg-gray-100 transition shadow-sm">
                <input type="checkbox" value="${p.id}" class="combo-prod-check w-5 h-5 accent-green-600">
                <span class="font-bold text-sm text-gray-700">${p.nome} (Custo Peça: R$ ${(p.custo || 0).toFixed(2)})</span>
            </label>
        `;
    });
};
