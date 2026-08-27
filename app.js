/* ========================================================
   ARQUIVO JAVASCRIPT (app.js): Controla toda a inteligência, 
   matemática e conexão com o banco de dados.
   ======================================================== */

// 1. CHAVES DO SEU BANCO DE DADOS (Firebase)
const firebaseConfig = {
    apiKey: "AIzaSyD7BK29fTPlGncEzamYz2sofuLjGUNqjRM",
    authDomain: "caramelo-controle.firebaseapp.com",
    databaseURL: "https://caramelo-controle-default-rtdb.firebaseio.com",
    projectId: "caramelo-controle",
    storageBucket: "caramelo-controle.firebasestorage.app",
    messagingSenderId: "861734596831",
    appId: "1:861734596831:web:cffbed20c2557521cab96a"
};

// 2. VARIÁVEIS NA MEMÓRIA
let db;              // Vai guardar a conexão com o banco
let vendas = [];     // Guarda todas as vendas puxadas da nuvem
let carrinho = [];   // Guarda os itens do pedido atual que está sendo montado

// 3. INICIAR CONEXÃO
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    document.getElementById('statusConexao').innerText = "✅ Banco Conectado!";
    document.getElementById('statusConexao').style.color = "#27ae60";
    escutarMudancasBanco(); 
} catch (error) {
    document.getElementById('statusConexao').innerText = "❌ Erro ao conectar: " + error.message;
}

// 4. CONFIGURAR AS DATAS PARA HOJE (Ao abrir a página)
const hoje = new Date();
document.getElementById('dataVenda').valueAsDate = hoje;
document.getElementById('dataFiltro').valueAsDate = hoje;

// Função utilitária para transformar 2026-08-23 em 23/08/2026
function formatarDataBR(iso) {
    if(!iso) return '-';
    const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`;
}

// Função utilitária para colocar R$ bonitinho
function formataMoeda(valor) {
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}


/* ========================================================
   SESSÃO DO CARRINHO (Montar Pedido)
   ======================================================== */

// Atualiza o textinho de "Valor deste lanche" antes de adicionar no carrinho
function atualizarPrecoItem() {
    const selectCat = document.getElementById('categoria');
    let precoBase = parseFloat(selectCat.options[selectCat.selectedIndex].getAttribute('data-preco'));
    
    if(document.getElementById('addBacon').checked) precoBase += 5;
    if(document.getElementById('addCatupiry').checked) precoBase += 5;
    if(document.getElementById('addRefri').checked) {
        precoBase += parseFloat(document.getElementById('precoRefri').value) || 0;
    }
    
    document.getElementById('precoItemAtual').innerText = formataMoeda(precoBase);
}

// Mostra/Esconde a caixa do valor do Refri se a caixa principal for marcada
function toggleRefriPrice() {
    document.getElementById('divRefriPreco').style.display = document.getElementById('addRefri').checked ? 'block' : 'none';
}

// Quando clica em "Adicionar ao Pedido" (Joga na lista)
function adicionarAoCarrinho() {
    const selectCat = document.getElementById('categoria');
    const nomeCat = selectCat.options[selectCat.selectedIndex].text.split(' - ')[0].replace('🌭 ', '');
    let precoBase = parseFloat(selectCat.options[selectCat.selectedIndex].getAttribute('data-preco'));
    
    let adicionais = [];
    if(document.getElementById('addBacon').checked) { adicionais.push('Bacon'); precoBase += 5; }
    if(document.getElementById('addCatupiry').checked) { adicionais.push('Catupiry'); precoBase += 5; }
    
    let refri = document.getElementById('addRefri').checked;
    let precoRefri = refri ? (parseFloat(document.getElementById('precoRefri').value) || 0) : 0;
    if(refri) { adicionais.push(`Refri(+R$${precoRefri.toFixed(2)})`); precoBase += precoRefri; }

    const itemDesc = `${nomeCat} ${adicionais.length > 0 ? '('+adicionais.join(', ')+')' : ''}`;
    
    // Adiciona na memória do carrinho
    carrinho.push({
        id: Date.now(), // Gera um ID único pelo milissegundo atual
        descricao: itemDesc,
        valor: precoBase
    });

    // Limpa os botoes marcados para montar o proximo lanche
    document.getElementById('addBacon').checked = false;
    document.getElementById('addCatupiry').checked = false;
    document.getElementById('addRefri').checked = false;
    document.getElementById('categoria').selectedIndex = 0;
    
    toggleRefriPrice();
    atualizarPrecoItem(); // Volta para R$ 15,00
    renderizarCarrinho(); // Atualiza a tela
}

// Tira um item especifico do carrinho se errou
function removerDoCarrinho(idItem) {
    carrinho = carrinho.filter(item => item.id !== idItem);
    renderizarCarrinho();
}

// Desenha a lista de Itens do Pedido Atual na tela
function renderizarCarrinho() {
    const ul = document.getElementById('listaCarrinho');
    ul.innerHTML = '';
    let total = 0;

    // Se estiver vazio, mostra mensagem
    if(carrinho.length === 0) {
        ul.innerHTML = '<li class="item-vazio">Nenhum item adicionado ainda.</li>';
        document.getElementById('totalPedido').innerText = 'R$ 0,00';
        calcularTroco();
        return;
    }

    // Se tiver itens, desenha as linhas
    carrinho.forEach(item => {
        total += item.valor;
        ul.innerHTML += `
            <li>
                <div class="item-info">✔️ ${item.descricao}</div>
                <div class="item-preco">${formataMoeda(item.valor)}</div>
                <button class="btn-remover-item" onclick="removerDoCarrinho(${item.id})">X</button>
            </li>
        `;
    });
    
    // Atualiza o Valor Total Gigante
    document.getElementById('totalPedido').innerText = formataMoeda(total);
    calcularTroco(); 
}

// Função de apoio para somar rápido
function getTotalCarrinho() {
    return carrinho.reduce((acc, curr) => acc + curr.valor, 0);
}


/* ========================================================
   SESSÃO DE TROCO (Matemática)
   ======================================================== */

// Se escolher Pix/Cartao, esconde a area de Dinheiro
function verificarTroco() {
    const pag = document.getElementById('pagamento').value;
    const bloco = document.getElementById('blocoDinheiro');
    if(pag === 'Dinheiro') {
        bloco.style.display = 'block';
        document.getElementById('valorRecebido').focus(); // Já pisca o cursor pra digitar
    } else {
        bloco.style.display = 'none';
        document.getElementById('valorRecebido').value = '';
        document.getElementById('valorTroco').innerText = 'R$ 0,00';
    }
}

// Calcula o troco enquanto a pessoa digita
function calcularTroco() {
    if(document.getElementById('pagamento').value !== 'Dinheiro') return;
    
    const total = getTotalCarrinho();
    const recebido = parseFloat(document.getElementById('valorRecebido').value) || 0;
    let troco = recebido - total;
    
    if(troco < 0) troco = 0; // Impede troco negativo se não pagou tudo
    
    document.getElementById('valorTroco').innerText = formataMoeda(troco);
}


/* ========================================================
   SESSÃO DE SALVAR NO BANCO (Nuvem)
   ======================================================== */

function finalizarPedido() {
    if(!db) { alert("Sem conexão com banco."); return; }
    if(carrinho.length === 0) { alert("O pedido está vazio! Adicione lanches primeiro."); return; }

    const totalPedido = getTotalCarrinho();
    const pagamento = document.getElementById('pagamento').value;
    
    let recebido = 0;
    let troco = 0;
    let formaDoTroco = '-';

    // Verificações antes de salvar se for Dinheiro
    if(pagamento === 'Dinheiro') {
        recebido = parseFloat(document.getElementById('valorRecebido').value) || 0;
        if(recebido < totalPedido) {
            alert("O valor recebido é menor que o total do pedido!");
            return;
        }
        troco = recebido - totalPedido;
        formaDoTroco = document.getElementById('formaTroco').value;
    }

    // Pega as linhas do carrinho e junta num texto só com " | " (barra em pé) separando
    const itensTexto = carrinho.map(i => i.descricao).join(' | ');

    // O PACOTE QUE VAI PRA NUVEM:
    const novoPedido = {
        data: document.getElementById('dataVenda').value,
        local: document.getElementById('localVenda').value,
        itens: itensTexto, 
        total: totalPedido,
        pagamento: pagamento,
        valorRecebido: recebido,
        trocoCalculado: troco,
        formaDoTroco: formaDoTroco,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp() // Pega a hora do Google
    };

    // Envia o pacote
    db.collection("vendas").add(novoPedido)
        .then(() => {
            // Esvazia carrinho e tela para o proximo cliente
            carrinho = [];
            renderizarCarrinho();
            document.getElementById('pagamento').selectedIndex = 0;
            verificarTroco();
            
            // Força a tabela da direita ir para o dia que acabou de ser vendido
            if(document.getElementById('dataFiltro').value !== novoPedido.data) {
                document.getElementById('dataFiltro').value = novoPedido.data;
                renderizarTabela();
            }
            
            // Pisca botão de verde para sucesso
            const btn = document.querySelector('.btn-primary');
            btn.innerText = "✅ Pedido Salvo!";
            btn.style.background = "#27ae60";
            setTimeout(() => { btn.innerText = "✅ Finalizar Pedido Completo"; btn.style.background = "var(--primary)"; }, 2000);
        })
        .catch((e) => alert("Erro ao salvar no banco: " + e.message));
}

// Botao de lixeira na tabela
function deletarVenda(id) {
    if(confirm("Apagar este pedido? Isso remove o dinheiro do caixa do dia.")) {
        db.collection("vendas").doc(id).delete();
    }
}

// Função que fica atenta a qualquer mudança no banco e atualiza a tela na mesma hora
function escutarMudancasBanco() {
    db.collection("vendas").orderBy("criadoEm", "asc").onSnapshot((qs) => {
        vendas = []; 
        qs.forEach((doc) => vendas.push({ id: doc.id, ...doc.data() }));
        renderizarTabela(); // Refaz a tabela sempre que algo altera na nuvem
    });
}


/* ========================================================
   SESSÃO DE RELATÓRIO E EXCEL (Direita)
   ======================================================== */

// Cria as linhas da Tabela (Só mostra os itens da Data selecionada no filtro)
function renderizarTabela() {
    const dataFiltro = document.getElementById('dataFiltro').value;
    document.getElementById('dataResumoTexto').innerText = formatarDataBR(dataFiltro);
    
    const tbody = document.querySelector('#tabelaVendas tbody');
    tbody.innerHTML = '';
    let qtd = 0; let total = 0;

    // Filtra e inverte para o último pedido aparecer no topo
    const vendasFiltro = vendas.filter(v => v.data === dataFiltro).reverse();

    vendasFiltro.forEach(v => {
        qtd++; total += v.total;
        
        // Trata a parte do troco para exibir bonitinho na tabela
        let detalhesTroco = '-';
        if(v.pagamento === 'Dinheiro') {
            detalhesTroco = `
                <div style="font-size:0.85em; color:#555;">
                    Rec: ${formataMoeda(v.valorRecebido)}<br>
                    Troco: <span style="color:var(--danger); font-weight:bold;">${formataMoeda(v.trocoCalculado)}</span><br>
                    <span class="badge badge-troco">Via ${v.formaDoTroco}</span>
                </div>
            `;
        }

        // Separa os lanches daquele texto " | " para ficar um debaixo do outro
        let itensHtml = (v.itens || '-').split(' | ').map(item => `<div style="margin-bottom:4px;">🔹 ${item}</div>`).join('');

        tbody.innerHTML += `
            <tr>
                <td><span class="badge badge-local">${v.local || '-'}</span></td>
                <td style="font-size: 0.9em; line-height:1.3;">${itensHtml}</td>
                <td><span class="badge">${v.pagamento}</span></td>
                <td>${detalhesTroco}</td>
                <td><strong>${formataMoeda(v.total)}</strong></td>
                <td class="no-print"><button class="btn-del" onclick="deletarVenda('${v.id}')">🗑️</button></td>
            </tr>
        `;
    });

    if (vendasFiltro.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhum pedido neste dia.</td></tr>`;
    }

    // Atualiza Caixinhas Superiores (Total)
    document.getElementById('resumoQtd').innerText = qtd;
    document.getElementById('resumoValor').innerText = formataMoeda(total);
}

// Botão de Exportar para Excel (.CSV)
function baixarPlanilha() {
    const dataFiltro = document.getElementById('dataFiltro').value;
    const vendasFiltro = vendas.filter(v => v.data === dataFiltro);
    
    if(vendasFiltro.length === 0) return alert("Não há vendas para baixar neste dia.");
    
    let csv = "Data,Local,Itens do Pedido,Pagamento,Valor Recebido,Troco Devolvido,Forma do Troco,Total Cobrado\n";
    
    vendasFiltro.forEach(v => {
        // Envolve os itens em aspas para a virgula não quebrar o Excel
        let itensProtegidos = `"${v.itens || '-'}"`; 
        let recebido = v.pagamento === 'Dinheiro' ? v.valorRecebido : 0;
        let troco = v.pagamento === 'Dinheiro' ? v.trocoCalculado : 0;
        let ft = v.pagamento === 'Dinheiro' ? v.formaDoTroco : '-';
        
        csv += `${v.data},${v.local || '-'},${itensProtegidos},${v.pagamento},${recebido},${troco},${ft},${v.total.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Fechamento_Caramelo_${dataFiltro}.csv`;
    link.click();
}

/* ========================================================
   SESSÃO DE GERAÇÃO DE PDF
   ======================================================== */

function gerarPDFRelatorio() {
    // Seleciona a área do relatório do caixa (a div da direita)
    const elemento = document.querySelector('.print-area');

    // Configurações do PDF
    const opcoes = {
        margin:       10,
        filename:     'relatorio-caixa-caramelo.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' } // 'landscape' deixa a folha deitada, ideal para tabelas
    };

    // Executa a conversão e o download
    html2pdf().from(elemento).set(opcoes).save();
}

// Função segura para imprimir apenas o painel de relatório
function imprimirRelatorio() {
    // Garante que o painel está visível antes de chamar a impressão
    window.print();
}