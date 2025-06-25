const preloader = document.getElementById('preloader');

// Define tempo mínimo de exibição (em ms)
const TEMPO_MINIMO = 1500;

const inicio = Date.now();

window.addEventListener('load', () => {
    const tempoDecorrido = Date.now() - inicio;
    const tempoRestante = Math.max(0, TEMPO_MINIMO - tempoDecorrido);

    setTimeout(() => {
        if (preloader) {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
            setTimeout(() => {
                preloader.remove();
            }, 400); // tempo da transição de fade
        }
    }, tempoRestante);
});


document.getElementById('formulario').addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById('submit-loader').style.display = 'flex';

    const mes = parseInt(document.getElementById('mes').value) - 1;
    const ano = parseInt(document.getElementById('ano').value);
    const totalMotoristas = parseInt(document.getElementById('motoristas').value);
    const resultadoDiv = document.getElementById('resultado');
    const btnAbrirPopup = document.getElementById('btn-abrir-popup');
    const popupDetalhes = document.getElementById('popup-detalhes');

    document.getElementById('btn-imprimir').style.display = 'inline-block';

    if (totalMotoristas < 3) {
        resultadoDiv.innerHTML = '<p style="color:red;">É necessário pelo menos 3 motoristas.</p>';
        btnAbrirPopup.style.display = 'none';
        return;
    }

    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const motoristas = Array.from({ length: totalMotoristas }, (_, i) => i + 1);
    const fixosPlantao = [1, 2];
    const outrosMotoristas = motoristas.filter(m => !fixosPlantao.includes(m));

    const pesos = {
        plantao: 1,
        porta: 1.5,
        bh: 3,
        bdd: 2,
    };

    let pontuacaoAcumulada = {};
    let diasTrabalhados = {};
    motoristas.forEach(m => {
        pontuacaoAcumulada[m] = 0;
        diasTrabalhados[m] = 0;
    });

    let proximaFuncao = {};
    outrosMotoristas.forEach(m => {
        const selectElement = document.getElementById(`motorista${m}_proxima`);
        proximaFuncao[m] = selectElement ? selectElement.value : 'porta';
    });

    let plantaoSabado = [];
    let plantaoDomingo = [];

    // Controle para alternância igualitária entre motoristas 1 e 2
    let contadorPlantao = { 1: 0, 2: 0 };
    let ultimoMotoristaPlantao = null;
    let trabalhouSexta = null; // Para controlar quem trabalhou na sexta

    let html = '<table><thead><tr><th>Data</th><th>Dia</th><th>Plantão</th><th>Porta</th><th>BH</th><th>BD/DIV/MN/SL</th><th>Folga</th></tr></thead><tbody>';

    let plantaoFdsPorMotorista = {};
    outrosMotoristas.forEach(m => plantaoFdsPorMotorista[m] = 0);


    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(ano, mes, dia);
        const diaSemana = data.getDay();
        const nomeDia = data.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataFormatada = data.toLocaleDateString('pt-BR');

        let usadosHoje = new Set();
        let plantao = [];
        let porta = [];
        let bh = [];
        let bdd = [];
        let folgas = [];

        if (diaSemana >= 1 && diaSemana <= 5) {
            let motoristaPlantao;

            // Lógica melhorada para distribuição igualitária
            if (diaSemana === 1) { // Segunda-feira
                // Se alguém trabalhou na sexta anterior, o outro trabalha na segunda
                if (trabalhouSexta !== null) {
                    motoristaPlantao = trabalhouSexta === 1 ? 2 : 1;
                } else {
                    // Primeira segunda do mês ou sem controle anterior
                    motoristaPlantao = contadorPlantao[1] <= contadorPlantao[2] ? 1 : 2;
                }
            } else if (diaSemana === 2) { // Terça-feira
                // Alterna com quem não trabalhou na segunda
                motoristaPlantao = ultimoMotoristaPlantao === 1 ? 2 : 1;
            } else if (diaSemana === 3) { // Quarta-feira
                // Alterna com quem não trabalhou na terça
                motoristaPlantao = ultimoMotoristaPlantao === 1 ? 2 : 1;
            } else if (diaSemana === 4) { // Quinta-feira
                // Alterna com quem não trabalhou na quarta
                motoristaPlantao = ultimoMotoristaPlantao === 1 ? 2 : 1;
            } else { // Sexta-feira
                // Alterna com quem não trabalhou na quinta e lembra para próxima segunda
                motoristaPlantao = ultimoMotoristaPlantao === 1 ? 2 : 1;
                trabalhouSexta = motoristaPlantao;
            }

            // Verificação de segurança para balanceamento
            if (Math.abs(contadorPlantao[1] - contadorPlantao[2]) > 2) {
                // Se a diferença for muito grande, força o menos utilizado
                motoristaPlantao = contadorPlantao[1] < contadorPlantao[2] ? 1 : 2;
            }

            plantao = [motoristaPlantao];
            usadosHoje.add(motoristaPlantao);
            pontuacaoAcumulada[motoristaPlantao] += pesos.plantao;
            diasTrabalhados[motoristaPlantao]++;
            contadorPlantao[motoristaPlantao]++;
            ultimoMotoristaPlantao = motoristaPlantao;

        } else if (diaSemana === 6) {
            plantaoSabado = selecionarMotoristas(outrosMotoristas, [], 2, pontuacaoAcumulada);
            plantao = plantaoSabado;
            plantao.forEach(m => {
                usadosHoje.add(m);
                pontuacaoAcumulada[m] += pesos.plantao;
                diasTrabalhados[m]++;
                plantaoFdsPorMotorista[m]++;
            });
        } else {
            const disponiveisDomingo = outrosMotoristas.filter(m => !plantaoSabado.includes(m));
            plantaoDomingo = selecionarMotoristas(disponiveisDomingo, [], 2, pontuacaoAcumulada);
            plantao = plantaoDomingo;
            plantao.forEach(m => {
                usadosHoje.add(m);
                pontuacaoAcumulada[m] += pesos.plantao;
                diasTrabalhados[m]++;
                plantaoFdsPorMotorista[m]++;
            });
        }

        if (diaSemana >= 1 && diaSemana <= 5) {
            const disponiveisParaFuncoes = outrosMotoristas.filter(m => !usadosHoje.has(m));

            if (disponiveisParaFuncoes.length > 6) {
                const candidatosFolga = disponiveisParaFuncoes.slice();
                candidatosFolga.sort((a, b) => pontuacaoAcumulada[b] - pontuacaoAcumulada[a]);
                folgas = [candidatosFolga[0]];
                usadosHoje.add(candidatosFolga[0]);
            }

            const restantesParaFuncoes = outrosMotoristas.filter(m => !usadosHoje.has(m));
            const funcoes = { bh: [], porta: [], bdd: [] };
            const restantesOrdenados = restantesParaFuncoes.slice();

            restantesOrdenados.sort((a, b) => {
                if (pontuacaoAcumulada[a] === pontuacaoAcumulada[b]) {
                    return a - b;
                }
                return pontuacaoAcumulada[a] - pontuacaoAcumulada[b];
            });

            for (let motorista of restantesOrdenados) {
                if (usadosHoje.has(motorista)) continue;
                const funcaoDesejada = proximaFuncao[motorista];
                if (funcoes[funcaoDesejada].length < 2) {
                    funcoes[funcaoDesejada].push(motorista);
                    usadosHoje.add(motorista);
                    diasTrabalhados[motorista]++;
                    atualizarProximaFuncao(motorista, proximaFuncao);
                }
            }

            const disponíveis = restantesParaFuncoes.filter(m => !usadosHoje.has(m));
            disponíveis.sort((a, b) => {
                if (pontuacaoAcumulada[a] === pontuacaoAcumulada[b]) {
                    return a - b;
                }
                return pontuacaoAcumulada[a] - pontuacaoAcumulada[b];
            });

            const ordemFuncoes = ['porta', 'bdd', 'bh'];
            for (let funcao of ordemFuncoes) {
                while (funcoes[funcao].length < 2 && disponíveis.length > 0) {
                    const motorista = disponíveis.shift();
                    funcoes[funcao].push(motorista);
                    usadosHoje.add(motorista);
                    diasTrabalhados[motorista]++;
                    proximaFuncao[motorista] = obterProximaFuncaoAposAtual(funcao);
                }
            }

            bh = funcoes.bh;
            porta = funcoes.porta;
            bdd = funcoes.bdd;

            bh.forEach(m => pontuacaoAcumulada[m] += pesos.bh);
            porta.forEach(m => pontuacaoAcumulada[m] += pesos.porta);
            bdd.forEach(m => pontuacaoAcumulada[m] += pesos.bdd);
        } else {
            porta = ['-'];
            bh = ['-'];
            bdd = ['-'];
            folgas = ['-'];
        }

        const plantaoTexto = plantao.length ? plantao.join(' e ') : '-';
        const portaTexto = porta.join(' e ');
        const bhTexto = bh.join(' e ');
        const bddTexto = bdd.join(' e ');
        const folgaTexto = folgas.join(' e ');

        const classeFimSemana = (diaSemana === 0 || diaSemana === 6) ? ' class="linha-fim-semana"' : '';

        html += `<tr${classeFimSemana}>
            <td>${dataFormatada}</td>
            <td>${nomeDia}</td>
            <td>${plantaoTexto}</td>
            <td>${portaTexto}</td>
            <td>${bhTexto}</td>
            <td>${bddTexto}</td>
            <td>${folgaTexto}</td>
        </tr>`;

    }

    html += '</tbody></table>';
    resultadoDiv.innerHTML = html;

    // Conteúdo do pop-up lateral
    let popupHtml = '<h3>📊 Dias Trabalhados por Motorista:</h3>';
    popupHtml += '<div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin: 10px 0;">';
    popupHtml += '<table><thead><tr><th>Motorista</th><th>Total de Horas</th><th>Detalhamento</th></tr></thead><tbody>';

    outrosMotoristas.forEach(m => {
        let detalhamento = '';
        if (m === 1 || m === 2) {
            detalhamento = `${contadorPlantao[m]} plantões`;
        } else {
            // Para outros motoristas, contar por função
            let plantoesFds = plantaoFdsPorMotorista[m];
            let outrosDias = diasTrabalhados[m];

            if (plantoesFds > 0) {
                detalhamento = `${outrosDias - plantoesFds} funções + ${plantoesFds} plantões FDS`;
            } else {
                detalhamento = `${outrosDias} funções`;
            }


            if (plantoesFds > 0) {
                detalhamento = `${outrosDias - plantoesFds} funções + ${plantoesFds} plantões FDS`;
            } else {
                detalhamento = `${outrosDias} funções`;
            }
        }

        const horasTrabalhadas = (m === 1 || m === 2) ? diasTrabalhados[m] * 15 : diasTrabalhados[m] * 8;
        popupHtml += `<tr><td>Motorista ${m}</td><td><strong>${horasTrabalhadas} horas</strong></td><td style="font-size: 12px; color: #666;">${detalhamento}</td></tr>`;
    });

    popupHtml += '</tbody></table>';

    // Calcular estatísticas
    const totalHoras = motoristas.reduce((total, m) => {
        return total + diasTrabalhados[m] * (m === 1 || m === 2 ? 15 : 8);
    }, 0);

    const horasIndividuais = motoristas.map(m => diasTrabalhados[m] * (m === 1 || m === 2 ? 15 : 8));
    const mediaHoras = (totalHoras / motoristas.length).toFixed(1);
    const maxHoras = Math.max(...horasIndividuais);
    const minHoras = Math.min(...horasIndividuais);



    popupHtml += `<div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 6px;">`;
    popupHtml += `<p style="margin: 0; font-size: 12px;"><strong>📈 Estatísticas:</strong></p>`;
    popupHtml += `<p style="margin: 5px 0 0 0; font-size: 11px; color: #555;">Média: ${mediaHoras} horas • Maior: ${maxHoras} horas • Menor: ${minHoras} horas • Diferença: ${maxHoras - minHoras} horas</p>`;
    popupHtml += `</div>`;
    popupHtml += '</div>';

    // Adicionar informações sobre distribuição de plantões
    popupHtml += '<h3 style="margin-top: 20px;">📊 Distribuição de Plantões:</h3>';
    popupHtml += '<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 10px 0;">';
    popupHtml += '<table><thead><tr><th>Motorista</th><th>Total de Horas</th><th>Plantões Realizados</th></tr></thead><tbody>';
    popupHtml += `<tr><td>Motorista 1</td><td><strong>${contadorPlantao[1] * 15} horas</strong></td><td>${contadorPlantao[1]} plantões</td></tr>`;
    popupHtml += `<tr><td>Motorista 2</td><td><strong>${contadorPlantao[2] * 15} horas</strong></td><td>${contadorPlantao[2]} plantões</td></tr>`;
    popupHtml += '</tbody></table>';
    popupHtml += `<p style="margin-top: 10px; font-size: 12px; color: #666;">Diferença: ${Math.abs(contadorPlantao[1] - contadorPlantao[2])} plantão(s)</p>`;
    popupHtml += '</div>';


    popupHtml += '<h3 style="margin-top: 20px;">⚠️ Configuração para o Próximo Mês:</h3>';
    popupHtml += '<div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">';
    popupHtml += '<p><strong>Próxima função de cada motorista:</strong></p>';
    popupHtml += '<table style="margin-top: 10px;"><thead><tr><th>Motorista</th><th>Próxima Função</th></tr></thead><tbody>';
    outrosMotoristas.forEach(m => {
        const funcaoNome = { 'porta': 'Porta', 'bdd': 'BD/DIV/MN/SL', 'bh': 'BH' };
        popupHtml += `<tr><td>Motorista ${m}</td><td><strong>${funcaoNome[proximaFuncao[m]]}</strong></td></tr>`;
    });
    popupHtml += '</tbody></table>';
    popupHtml += '<p style="margin-top: 10px; font-size: 12px; color: #666;">💡 <strong>Dica:</strong> Anote essas informações e configure no formulário ao gerar a escala do próximo mês!</p>';

    // Adicionar informação sobre quem deve começar na próxima segunda
    if (trabalhouSexta !== null) {
        const proximoMotorista = trabalhouSexta === 1 ? 2 : 1;
        popupHtml += `<p style="margin-top: 10px; font-size: 12px; color: #e67e22;"><strong>🔄 Próximo mês:</strong> Motorista ${proximoMotorista} deve começar na primeira segunda-feira para manter a alternância.</p>`;
    }

    popupHtml += '</div>';

    document.getElementById('conteudo-popup').innerHTML = popupHtml;
    // Salvar estado no localStorage
    const estadoSalvo = {
        ano,
        mes,
        totalMotoristas,
        htmlEscala: html,
        htmlPopup: popupHtml,
        proximaFuncao,
        trabalhouSexta,
        contadorPlantao,
        plantaoFdsPorMotorista
    };
    localStorage.setItem('estadoEscala', JSON.stringify(estadoSalvo));


    // Mostrar botão flutuante e abrir popup automaticamente
    btnAbrirPopup.style.display = 'none';
    popupDetalhes.classList.add('open');
    setTimeout(() => {
        document.getElementById('submit-loader').style.display = 'none';
    }, 600);
});

// Funções auxiliares
function selecionarMotoristas(lista, excluir, quantidade, pontuacao) {
    const disponiveis = lista.filter(m => !excluir.includes(m));
    if (disponiveis.length < quantidade) return disponiveis;
    disponiveis.sort((a, b) => {
        if (pontuacao[a] === pontuacao[b]) return a - b;
        return pontuacao[a] - pontuacao[b];
    });
    return disponiveis.slice(0, quantidade);
}

function atualizarProximaFuncao(motorista, proximaFuncao) {
    const ciclo = { 'porta': 'bdd', 'bdd': 'bh', 'bh': 'porta' };
    proximaFuncao[motorista] = ciclo[proximaFuncao[motorista]];
}

function obterProximaFuncaoAposAtual(funcaoAtual) {
    const ciclo = { 'porta': 'bdd', 'bdd': 'bh', 'bh': 'porta' };
    return ciclo[funcaoAtual] || 'porta';
}

const estadoSalvo = localStorage.getItem('estadoEscala');
if (estadoSalvo) {
    const estado = JSON.parse(estadoSalvo);
    document.getElementById('ano').value = estado.ano;
    document.getElementById('mes').value = estado.mes + 1; // mes salvo começa em 0
    document.getElementById('motoristas').value = estado.totalMotoristas;

    // Cria os campos de rodízio primeiro
    criarCamposRodizio();

    // Espera os campos de rodízio aparecerem antes de setar valores
    setTimeout(() => {
        Object.keys(estado.proximaFuncao).forEach(m => {
            const select = document.getElementById(`motorista${m}_proxima`);
            if (select) {
                select.value = estado.proximaFuncao[m];
            }
        });
    }, 100);
}



function criarCamposRodizio() {
    const totalMotoristas = parseInt(document.getElementById('motoristas').value);
    const configDiv = document.getElementById('config-rodizio');
    if (!configDiv || totalMotoristas < 3) return;

    const outrosMotoristas = Array.from({ length: totalMotoristas - 2 }, (_, i) => i + 3);
    let html = '<h4>🔄 Configuração do Rodízio (opcional):</h4>';
    html += '<p style="font-size: 12px; color: #666; margin-bottom: 10px;">Se este não é o primeiro mês, configure onde cada motorista deve continuar:</p>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">';

    outrosMotoristas.forEach(m => {
        html += `
        <div style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <label for="motorista${m}_proxima" style="font-weight: bold;">Motorista ${m}:</label>
            <select id="motorista${m}_proxima" style="width: 100%; margin-top: 4px;">
                <option value="porta">Porta (padrão)</option>
                <option value="bdd">BD/DIV/MN/SL</option>
                <option value="bh">BH</option>
            </select>
        </div>
        `;
    });

    html += '</div>';
    html += '<p style="font-size: 11px; color: #888; margin-top: 8px;">💡 Se for o primeiro mês ou não souber, deixe tudo em "Porta (padrão)"</p>';
    configDiv.innerHTML = html;
}
['mes', 'ano', 'motoristas'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        const mes = parseInt(document.getElementById('mes').value);
        const ano = parseInt(document.getElementById('ano').value);
        const motoristas = parseInt(document.getElementById('motoristas').value);

        if (mes >= 1 && mes <= 12 && ano > 0 && motoristas >= 3) {
            criarCamposRodizio();
        }
    });
});

document.getElementById('motoristas').addEventListener('change', criarCamposRodizio);

document.addEventListener('DOMContentLoaded', function () {
    const estadoSalvoJSON = localStorage.getItem('estadoEscala');
    if (estadoSalvoJSON) {
        const estadoSalvo = JSON.parse(estadoSalvoJSON);
        document.getElementById('ano').value = estadoSalvo.ano;
        document.getElementById('mes').value = estadoSalvo.mes + 1;
        document.getElementById('motoristas').value = estadoSalvo.totalMotoristas;

        criarCamposRodizio();

        setTimeout(() => {
            Object.keys(estadoSalvo.proximaFuncao).forEach(m => {
                const select = document.getElementById(`motorista${m}_proxima`);
                if (select) {
                    select.value = estadoSalvo.proximaFuncao[m];
                }
            });

            document.getElementById('resultado').innerHTML = estadoSalvo.htmlEscala;
            document.getElementById('conteudo-popup').innerHTML = estadoSalvo.htmlPopup;

            // Tornar o botão imprimir visível
            document.getElementById('btn-imprimir').style.display = 'inline-block';

            const btnAbrirPopup = document.getElementById('btn-abrir-popup');
            const popupDetalhes = document.getElementById('popup-detalhes');
            btnAbrirPopup.style.display = 'none';
            popupDetalhes.classList.add('open');

        }, 150);
    } else {
        if (document.getElementById('motoristas').value) {
            criarCamposRodizio();
        }
    }

    const fecharBtn = document.getElementById('fechar-popup');
    if (fecharBtn) {
        fecharBtn.addEventListener('click', fecharPopup);
    }
});


// Botão imprimir
document.getElementById('btn-imprimir').addEventListener('click', function () {
    const resultado = document.getElementById('resultado').innerHTML;
    const mes = document.getElementById('mes').value;
    const ano = document.getElementById('ano').value;
    const totalMotoristas = document.getElementById('motoristas').value;

    // Nomes dos meses
    const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const janelaImpressao = window.open('', '', 'width=800,height=600');
    janelaImpressao.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Escala de Motoristas - ${nomesMeses[mes - 1]} ${ano}</title>
            <meta charset="utf-8">
            <style>
                @page {
                    size: A4;
                    margin: 15mm;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    font-size: 10px;
                    line-height: 1.2;
                    color: #333;
                    background: white;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #2c5aa0;
                }
                
                .header h1 {
                    font-size: 18px;
                    color: #2c5aa0;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                
                .header h2 {
                    font-size: 14px;
                    color: #666;
                    font-weight: normal;
                }
                
                .info-box {
                    background: #f8f9ff;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 8px;
                    margin-bottom: 15px;
                    text-align: center;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                    font-size: 9px;
                }
                
                thead th {
                    background: linear-gradient(135deg, #2c5aa0, #1e3a73);
                    color: white;
                    font-weight: bold;
                    padding: 8px 4px;
                    text-align: center;
                    border: 1px solid #1e3a73;
                    font-size: 9px;
                }
                
                tbody td {
                    padding: 6px 3px;
                    text-align: center;
                    border: 1px solid #ccc;
                    vertical-align: middle;
                }
                
                tbody tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                
                tbody tr:hover {
                    background-color: #f0f8ff;
                }
                
                /* Destaque para fins de semana */
                .linha-fim-semana {
                    background: #ffe6e6 !important;
                    font-weight: bold;
                }
                
                .linha-fim-semana td {
                    border-color: #ff9999;
                }
                
                .linha-fim-semana {
                    border-top: 2px solid #ff9999 !important;
                    border-bottom: 2px solid #ff9999 !important;
                }

                
                /* Estilo das colunas */
                td:first-child {
                    font-size: 10px;
                    font-weight: bold;
                    background: #f0f8ff;
                    width: 12%;
                }
                
                td:nth-child(2) {
                    font-size: 10px;
                    font-weight: bold;
                    width: 12%;
                }
                
                td:nth-child(3) {
                    font-size: 10px;
                    font-weight: bold;
                    background: #e8f5e8;
                    color:rgb(0, 0, 0);
                    width: 15%;
                }
                
                td:nth-child(4) {
                    font-size: 10px;
                    font-weight: bold;
                    background: #fff3e0;
                    color:rgb(0, 0, 0);
                    width: 15%;
                }
                
                td:nth-child(5) {
                    font-size: 10px;
                    font-weight: bold;
                    background: #e3f2fd;
                    color:rgb(0, 0, 0);
                    width: 15%;
                }
                
                td:nth-child(6) {
                    font-size: 10px;
                    font-weight: bold;
                    background: #fce4ec;
                    color:rgb(0, 0, 0);
                    width: 16%;
                }
                
                td:nth-child(7) {
                    font-size: 10px;
                    font-weight: bold;
                    background: #f3e5f5;
                    color:rgb(0, 0, 0);
                    font-style: italic;
                    width: 15%;
                }
                
                .footer {
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #ddd;
                    font-size: 8px;
                    color: #666;
                    text-align: center;
                }
                
                .legenda {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 10px;
                    font-size: 8px;
                }
                
                .legenda-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .cor-plantao { 
                    width: 12px; 
                    height: 12px; 
                    background: #e8f5e8; 
                    border: 1px solid #4caf50; 
                    border-radius: 2px;
                }
                .cor-porta { 
                    width: 12px; 
                    height: 12px; 
                    background: #fff3e0; 
                    border: 1px solid #ff9800; 
                    border-radius: 2px;
                }
                .cor-bh { 
                    width: 12px; 
                    height: 12px; 
                    background: #e3f2fd; 
                    border: 1px solid #2196f3; 
                    border-radius: 2px;
                }
                .cor-bdd { 
                    width: 12px; 
                    height: 12px; 
                    background: #fce4ec; 
                    border: 1px solid #e91e63; 
                    border-radius: 2px;
                }
                .cor-folga { 
                    width: 12px; 
                    height: 12px; 
                    background: #f3e5f5; 
                    border: 1px solid #9c27b0; 
                    border-radius: 2px;
                }
                .cor-fds { 
                    width: 12px; 
                    height: 12px; 
                    background: #ffe6e6; 
                    border: 1px solid #f44336; 
                    border-radius: 2px;
                }
                
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .header h1 {
                        font-size: 16px;
                    }
                    
                    table {
                        font-size: 8px;
                    }
                    
                    thead th {
                        font-size: 8px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 ESCALA DE MOTORISTAS</h1>
                <h2>${nomesMeses[mes - 1]} de ${ano} • Total: ${totalMotoristas} Motoristas</h2>
            </div>
            
            <div class="info-box">
                <strong>🚛 Funções:</strong> 
                <span style="color: #2d5016;">Plantão</span> • 
                <span style="color: #e65100;">Porta</span> • 
                <span style="color: #0277bd;">BH</span> • 
                <span style="color: #c2185b;">BD/DIV/MN/SL</span> • 
                <span style="color: #7b1fa2;">Folga</span>
            </div>
            
            ${resultado}
            
            <div class="legenda">
                <div class="legenda-item">
                    <div class="cor-plantao"></div>
                    <span>Plantão</span>
                </div>
                <div class="legenda-item">
                    <div class="cor-porta"></div>
                    <span>Porta</span>
                </div>
                <div class="legenda-item">
                    <div class="cor-bh"></div>
                    <span>BH</span>
                </div>
                <div class="legenda-item">
                    <div class="cor-bdd"></div>
                    <span>BD/DIV/MN/SL</span>
                </div>
                <div class="legenda-item">
                    <div class="cor-folga"></div>
                    <span>Folga</span>
                </div>
                <div class="legenda-item">
                    <div class="cor-fds"></div>
                    <span>Fim de Semana</span>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
                <p>Sistema de Escala de Motoristas - Distribuição Automática e Equilibrada</p>
            </div>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    janelaImpressao.focus();

    // Aguardar o carregamento completo antes de imprimir
    setTimeout(() => {
        janelaImpressao.print();
        janelaImpressao.close();
    }, 250);
});

// Botão flutuante para abrir popup
const btnAbrirPopup = document.getElementById('btn-abrir-popup');
const popupDetalhes = document.getElementById('popup-detalhes');

btnAbrirPopup.addEventListener('click', () => {
    popupDetalhes.classList.add('open');
    btnAbrirPopup.style.display = 'none';
});

function fecharPopup() {
    popupDetalhes.classList.remove('open');
    btnAbrirPopup.style.display = 'inline-block';  // Reexibe o botão ao fechar
}
// Abrir modal ao clicar no botão resetar
document.getElementById('btn-resetar').addEventListener('click', function () {
    document.getElementById('modal-confirmacao').style.display = 'flex';
});

// Cancelar a ação
document.getElementById('cancelar-reset').addEventListener('click', function () {
    document.getElementById('modal-confirmacao').style.display = 'none';
});

// Confirmar a ação
document.getElementById('confirmar-reset').addEventListener('click', function () {
    localStorage.removeItem('estadoEscala');
    location.reload();
});
