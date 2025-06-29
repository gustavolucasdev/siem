// ========================================
// SIEM - SISTEMA DE ESCALA DE MOTORISTAS
// ========================================

const preloader = document.getElementById('preloader');
const TEMPO_MINIMO = 1500;
const inicio = Date.now();

window.addEventListener('load', () => {
    const tempoDecorrido = Date.now() - inicio;
    const tempoRestante = Math.max(0, TEMPO_MINIMO - tempoDecorrido);

    setTimeout(() => {
        if (preloader) {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
            setTimeout(() => preloader.remove(), 400);
        }
    }, tempoRestante);
});

// ========================================
// CLASSE PRINCIPAL - GERENCIADOR DE ESCALA
// ========================================

class GerenciadorEscala {
    constructor() {
        this.escalaAnual = [];
        this.estadoMotoristas = {};
        this.contadorPlantao = { 1: 0, 2: 0 };
        this.ultimoMotoristaPlantao = null;
        this.trabalhouSextaAnterior = null;
        this.ordemCiclica = ['porta', 'bh', 'folga', 'bdd', 'plantao_fds'];
        this.estatisticas = {};
        // NOVA PROPRIEDADE: Rastrear alocações do último dia processado
        this.ultimoDiaProcessado = null;
    }

    // Inicializa estado dos motoristas
    inicializarMotoristas(totalMotoristas) {
        this.estadoMotoristas = {};
        for (let i = 1; i <= totalMotoristas; i++) {
            this.estadoMotoristas[i] = {
                proximaFuncao: i <= 2 ? 'plantao_semana' : 'porta',
                diasTrabalhados: 0,
                pontuacao: 0,
                folgasSemana: [],
                ultimoTrabalho: null,
                plantoesFds: 0
            };
        }
    }

    // Gera escala anual completa
    gerarEscalaAnual(ano, totalMotoristas) {
        this.inicializarMotoristas(totalMotoristas);
        this.escalaAnual = [];

        for (let mes = 0; mes < 12; mes++) {
            const diasNoMes = new Date(ano, mes + 1, 0).getDate();

            for (let dia = 1; dia <= diasNoMes; dia++) {
                const data = new Date(ano, mes, dia);
                const diaSemana = data.getDay();
                const escalaHoje = this.processarDia(data, totalMotoristas);

                this.escalaAnual.push({
                    data: data,
                    diaSemana: diaSemana,
                    mes: mes,
                    dia: dia,
                    ...escalaHoje
                });
            }
        }

        return this.escalaAnual;
    }

    // Processa um dia específico
    processarDia(data, totalMotoristas) {
        const diaSemana = data.getDay();
        const motoristas = Array.from({ length: totalMotoristas }, (_, i) => i + 1);
        const outrosMotoristas = motoristas.filter(m => m > 2);

        let resultado = {
            plantao: [],
            porta: [],
            bh: [],
            bdd: [],
            folgas: []
        };

        // Limpar folgas da semana anterior se for segunda-feira
        if (diaSemana === 1) {
            outrosMotoristas.forEach(m => {
                this.estadoMotoristas[m].folgasSemana = [];
            });
        }

        if (diaSemana >= 1 && diaSemana <= 5) {
            // Dias úteis (Segunda a Sexta)
            resultado.plantao = this.alocarPlantaoSemana(data);
            resultado = this.alocarFuncoesDiasUteis(resultado, outrosMotoristas, data);
        } else {
            // Fins de semana (Sábado e Domingo)
            resultado.plantao = this.alocarPlantaoFimSemana(outrosMotoristas, data);
            resultado.porta = ['-'];
            resultado.bh = ['-'];
            resultado.bdd = ['-'];
            resultado.folgas = ['-'];
        }

        // SALVAR ÚLTIMO DIA PROCESSADO
        this.ultimoDiaProcessado = {
            data: new Date(data),
            diaSemana: diaSemana,
            ...resultado
        };

        return resultado;
    }
    // Aloca plantão para dias úteis (motoristas 1 e 2)
    alocarPlantaoSemana() {
        const diaSemana = new Date().getDay();
        let motoristaPlantao;

        // Lógica de alternância inteligente
        if (diaSemana === 1) { // Segunda-feira
            if (this.trabalhouSextaAnterior !== null) {
                motoristaPlantao = this.trabalhouSextaAnterior === 1 ? 2 : 1;
            } else {
                motoristaPlantao = this.contadorPlantao[1] <= this.contadorPlantao[2] ? 1 : 2;
            }
        } else {
            // Outros dias da semana - alterna com quem não trabalhou no dia anterior
            motoristaPlantao = this.ultimoMotoristaPlantao === 1 ? 2 : 1;
        }

        // Verificação de balanceamento
        if (Math.abs(this.contadorPlantao[1] - this.contadorPlantao[2]) > 2) {
            motoristaPlantao = this.contadorPlantao[1] < this.contadorPlantao[2] ? 1 : 2;
        }

        // Atualizar contadores
        this.contadorPlantao[motoristaPlantao]++;
        this.estadoMotoristas[motoristaPlantao].diasTrabalhados++;
        this.estadoMotoristas[motoristaPlantao].pontuacao += 1;
        this.ultimoMotoristaPlantao = motoristaPlantao;

        // Salvar se trabalhou na sexta para próxima segunda
        if (diaSemana === 5) {
            this.trabalhouSextaAnterior = motoristaPlantao;
        }

        return [motoristaPlantao];
    }

    // Aloca plantão para fins de semana (motoristas 3+)
    alocarPlantaoFimSemana(outrosMotoristas, data) {
        const disponiveisPlantao = outrosMotoristas.filter(m => {
            const estado = this.estadoMotoristas[m];
            // Evita repetição de plantão FDS consecutivo
            const naoTrabalhouPlantaoFdsConsecutivo = estado.ultimoTrabalho !== 'plantao_fds';
            // NOVA VERIFICAÇÃO: Evita conflito com dia anterior
            const naoTemConflitoComOntem = !this.verificarConflitoComDiaAnterior(m, 'plantao', data);

            return naoTrabalhouPlantaoFdsConsecutivo && naoTemConflitoComOntem;
        });

        // Se não há disponíveis sem conflito, relaxar a regra do dia anterior
        const motoristasFinal = disponiveisPlantao.length >= 2 ?
            disponiveisPlantao :
            outrosMotoristas.filter(m => this.estadoMotoristas[m].ultimoTrabalho !== 'plantao_fds');

        // Ordena por menor pontuação e depois por número do motorista
        motoristasFinal.sort((a, b) => {
            const pontuacaoA = this.estadoMotoristas[a].pontuacao;
            const pontuacaoB = this.estadoMotoristas[b].pontuacao;
            if (pontuacaoA === pontuacaoB) return a - b;
            return pontuacaoA - pontuacaoB;
        });

        const selecionados = motoristasFinal.slice(0, 2);

        selecionados.forEach(m => {
            this.estadoMotoristas[m].diasTrabalhados++;
            this.estadoMotoristas[m].pontuacao += 1;
            this.estadoMotoristas[m].plantoesFds++;
            this.estadoMotoristas[m].ultimoTrabalho = 'plantao_fds';
            this.estadoMotoristas[m].proximaFuncao = this.obterProximaFuncao(m);
        });

        return selecionados;
    }

    // Aloca funções para dias úteis (motoristas 3+)
    alocarFuncoesDiasUteis(resultado, outrosMotoristas, data) {
        const usadosHoje = new Set(resultado.plantao);
        const disponiveisTrabalho = outrosMotoristas.filter(m => !usadosHoje.has(m));

        // Primeiro, aloca folgas
        const candidatosFolga = disponiveisTrabalho.filter(m => {
            const estado = this.estadoMotoristas[m];
            return estado.folgasSemana.length === 0 ||
                (estado.folgasSemana.length < 1 && Math.random() > 0.7);
        });

        if (candidatosFolga.length > 0 && disponiveisTrabalho.length > 6) {
            candidatosFolga.sort((a, b) => {
                const pontuacaoA = this.estadoMotoristas[a].pontuacao;
                const pontuacaoB = this.estadoMotoristas[b].pontuacao;
                return pontuacaoB - pontuacaoA;
            });

            const motoristaFolga = candidatosFolga[0];
            resultado.folgas = [motoristaFolga];
            usadosHoje.add(motoristaFolga);
            this.estadoMotoristas[motoristaFolga].folgasSemana.push(data.getDay());
            this.estadoMotoristas[motoristaFolga].ultimoTrabalho = 'folga';
        }

        // Alocar funções de trabalho COM VERIFICAÇÃO DE CONFLITO
        const restantesTrabalho = disponiveisTrabalho.filter(m => !usadosHoje.has(m));
        const funcoes = { porta: [], bh: [], bdd: [] };

        // Primeiro, tentar alocar sem conflitos
        const semConflito = restantesTrabalho.filter(m => {
            const funcaoDesejada = this.estadoMotoristas[m].proximaFuncao;
            return !this.verificarConflitoComDiaAnterior(m, funcaoDesejada, data);
        });

        // Se não há motoristas suficientes sem conflito, usar todos
        const motoristasParaAlocar = semConflito.length >= 6 ? semConflito : restantesTrabalho;

        motoristasParaAlocar.sort((a, b) => {
            const estadoA = this.estadoMotoristas[a];
            const estadoB = this.estadoMotoristas[b];

            // Priorizar quem não tem conflito com dia anterior
            const conflitoA = this.verificarConflitoComDiaAnterior(a, estadoA.proximaFuncao, data);
            const conflitoB = this.verificarConflitoComDiaAnterior(b, estadoB.proximaFuncao, data);

            if (conflitoA !== conflitoB) {
                return conflitoA ? 1 : -1; // Sem conflito primeiro
            }

            if (estadoA.proximaFuncao !== estadoB.proximaFuncao) {
                const ordemPrioridade = ['porta', 'bh', 'bdd'];
                return ordemPrioridade.indexOf(estadoA.proximaFuncao) -
                    ordemPrioridade.indexOf(estadoB.proximaFuncao);
            }

            if (estadoA.pontuacao === estadoB.pontuacao) return a - b;
            return estadoA.pontuacao - estadoB.pontuacao;
        });

        // Distribuir nas funções
        for (let motorista of motoristasParaAlocar) {
            const funcaoDesejada = this.estadoMotoristas[motorista].proximaFuncao;
            const temConflito = this.verificarConflitoComDiaAnterior(motorista, funcaoDesejada, data);

            // Se tem conflito, tentar outra função
            if (temConflito) {
                const funcoesAlternativas = ['porta', 'bh', 'bdd'].filter(f =>
                    f !== funcaoDesejada &&
                    !this.verificarConflitoComDiaAnterior(motorista, f, data) &&
                    funcoes[f].length < 2
                );

                if (funcoesAlternativas.length > 0) {
                    const funcaoEscolhida = funcoesAlternativas[0];
                    funcoes[funcaoEscolhida].push(motorista);
                    this.atualizarEstadoMotorista(motorista, funcaoEscolhida);
                    continue;
                }
            }

            // Alocar na função desejada se possível
            if (funcoes[funcaoDesejada] && funcoes[funcaoDesejada].length < 2) {
                funcoes[funcaoDesejada].push(motorista);
                this.atualizarEstadoMotorista(motorista, funcaoDesejada);
            } else {
                // Alocar na primeira função disponível
                const funcaoDisponivel = Object.keys(funcoes).find(f => funcoes[f].length < 2);
                if (funcaoDisponivel) {
                    funcoes[funcaoDisponivel].push(motorista);
                    this.atualizarEstadoMotorista(motorista, funcaoDisponivel);
                }
            }
        }

        resultado.porta = funcoes.porta;
        resultado.bh = funcoes.bh;
        resultado.bdd = funcoes.bdd;

        return resultado;
    }

    // Atualiza o estado do motorista após alocação
    atualizarEstadoMotorista(motorista, funcao) {
        const estado = this.estadoMotoristas[motorista];
        const pesos = { porta: 1.5, bh: 3, bdd: 2, plantao_fds: 1, folga: 0 };

        estado.diasTrabalhados++;
        estado.pontuacao += pesos[funcao] || 1;
        estado.ultimoTrabalho = funcao;
        estado.proximaFuncao = this.obterProximaFuncao(motorista);
    }

    // Obtém próxima função na ordem cíclica
    obterProximaFuncao(motorista) {
        if (motorista <= 2) return 'plantao_semana';

        const estado = this.estadoMotoristas[motorista];
        const funcaoAtual = estado.ultimoTrabalho || 'porta';
        const cicloDinamico = ['porta', 'bh', 'bdd']; // Removemos folga e plantao_fds do ciclo automático

        const indiceAtual = cicloDinamico.indexOf(funcaoAtual);
        if (indiceAtual === -1) return 'porta';

        return cicloDinamico[(indiceAtual + 1) % cicloDinamico.length];
    }

    // Calcula estatísticas finais
    calcularEstatisticas(escalaMes) {
        this.estatisticas = {
            totalDias: escalaMes.length,
            distribuicaoMotoristas: {},
            balanceamento: {}
        };

        // Inicializar contadores para cada motorista
        const contadoresMotoristas = {};

        // Descobrir quantos motoristas existem baseado na escala do mês
        const todosMotoristas = new Set();
        escalaMes.forEach(dia => {
            [...dia.plantao, ...dia.porta, ...dia.bh, ...dia.bdd, ...dia.folgas].forEach(m => {
                if (m !== '-' && typeof m === 'number') {
                    todosMotoristas.add(m);
                }
            });
        });

        // Inicializar contadores
        todosMotoristas.forEach(m => {
            contadoresMotoristas[m] = {
                diasTrabalhados: 0,
                plantoesFds: 0,
                funcoesSemana: 0
            };
        });

        // Contar dias trabalhados no mês
        escalaMes.forEach(dia => {
            const diaSemana = dia.diaSemana;
            const ehFimSemana = diaSemana === 0 || diaSemana === 6;

            // Contar plantões
            dia.plantao.forEach(m => {
                if (m !== '-' && typeof m === 'number') {
                    contadoresMotoristas[m].diasTrabalhados++;
                    if (ehFimSemana) {
                        contadoresMotoristas[m].plantoesFds++;
                    }
                }
            });

            // Contar outras funções (porta, bh, bdd)
            [...dia.porta, ...dia.bh, ...dia.bdd].forEach(m => {
                if (m !== '-' && typeof m === 'number') {
                    contadoresMotoristas[m].diasTrabalhados++;
                    contadoresMotoristas[m].funcoesSemana++;
                }
            });
        });

        // Calcular estatísticas finais
        Object.keys(contadoresMotoristas).forEach(m => {
            const motorista = parseInt(m);
            const dados = contadoresMotoristas[m];
            const horasTrabalhadas = motorista <= 2 ? dados.diasTrabalhados * 15 : dados.diasTrabalhados * 8;

            this.estatisticas.distribuicaoMotoristas[m] = {
                diasTrabalhados: dados.diasTrabalhados,
                horasTrabalhadas: horasTrabalhadas,
                pontuacao: dados.diasTrabalhados,
                plantoesFds: dados.plantoesFds,
                funcoesSemana: dados.funcoesSemana
            };
        });
    }

    verificarConflitoComDiaAnterior(motorista, funcao, dataAtual) {
        if (!this.ultimoDiaProcessado) return false;

        // Verificar se é o dia seguinte ao último processado
        const ontem = new Date(dataAtual);
        ontem.setDate(ontem.getDate() - 1);

        if (ontem.toDateString() === this.ultimoDiaProcessado.data.toDateString()) {
            // Verificar se o motorista trabalhou ontem na mesma função
            const trabalhouOntemNaMesmaFuncao = this.verificarTrabalhouOntem(motorista, funcao);
            return trabalhouOntemNaMesmaFuncao;
        }

        return false;
    }

    verificarTrabalhouOntem(motorista, funcao) {
        if (!this.ultimoDiaProcessado) return false;

        const ultimoDia = this.ultimoDiaProcessado;

        // Verificar em todas as funções do último dia
        const todasFuncoesOntem = [
            ...ultimoDia.plantao,
            ...ultimoDia.porta,
            ...ultimoDia.bh,
            ...ultimoDia.bdd
        ];

        // Se trabalhou ontem, verificar se foi na mesma função
        if (todasFuncoesOntem.includes(motorista)) {
            if (funcao === 'plantao' && ultimoDia.plantao.includes(motorista)) return true;
            if (funcao === 'porta' && ultimoDia.porta.includes(motorista)) return true;
            if (funcao === 'bh' && ultimoDia.bh.includes(motorista)) return true;
            if (funcao === 'bdd' && ultimoDia.bdd.includes(motorista)) return true;
        }

        return false;
    }

    validarTransicoes() {
        const problemas = [];

        for (let i = 1; i < this.escalaAnual.length; i++) {
            const hoje = this.escalaAnual[i];
            const ontem = this.escalaAnual[i - 1];

            // Verificar se é dia consecutivo
            const dataOntem = new Date(ontem.data);
            const dataHoje = new Date(hoje.data);
            dataOntem.setDate(dataOntem.getDate() + 1);

            if (dataOntem.toDateString() === dataHoje.toDateString()) {
                // Verificar conflitos
                const funcoesHoje = {
                    plantao: hoje.plantao,
                    porta: hoje.porta,
                    bh: hoje.bh,
                    bdd: hoje.bdd
                };

                const funcoesOntem = {
                    plantao: ontem.plantao,
                    porta: ontem.porta,
                    bh: ontem.bh,
                    bdd: ontem.bdd
                };

                Object.keys(funcoesHoje).forEach(funcao => {
                    const motoristasHoje = funcoesHoje[funcao];
                    const motoristasOntem = funcoesOntem[funcao];

                    const repeticoes = motoristasHoje.filter(m => motoristasOntem.includes(m));
                    if (repeticoes.length > 0) {
                        problemas.push({
                            data: hoje.data.toLocaleDateString('pt-BR'),
                            funcao: funcao,
                            motoristas: repeticoes,
                            tipo: 'mesma_funcao_consecutiva'
                        });
                    }
                });
            }
        }

        return problemas;
    }
}

// ========================================
// INTERFACE E EVENTOS
// ========================================

// Instância global do gerenciador
let gerenciador = new GerenciadorEscala();

// Event Listener principal do formulário
document.getElementById('formulario').addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById('submit-loader').style.display = 'flex';

    const mes = parseInt(document.getElementById('mes').value) - 1;
    const ano = parseInt(document.getElementById('ano').value);
    const totalMotoristas = parseInt(document.getElementById('motoristas').value);
    const resultadoDiv = document.getElementById('resultado');
    const btnAbrirPopup = document.getElementById('btn-abrir-popup');

    document.getElementById('btn-imprimir').style.display = 'inline-block';

    // Validação básica
    if (totalMotoristas < 3) {
        resultadoDiv.innerHTML = '<p style="color:red;">É necessário pelo menos 3 motoristas.</p>';
        btnAbrirPopup.style.display = 'none';
        document.getElementById('submit-loader').style.display = 'none';
        return;
    }

    // Gera escala anual
    gerenciador.gerarEscalaAnual(ano, totalMotoristas);

    // Filtra e exibe apenas o mês selecionado
    const escalaMes = gerenciador.escalaAnual.filter(dia => dia.mes === mes);

    // Calcular estatísticas específicas do mês selecionado
    gerenciador.calcularEstatisticas(escalaMes);

    const htmlEscala = gerarHtmlEscala(escalaMes);
    const htmlPopup = gerarHtmlPopup(gerenciador.estatisticas, totalMotoristas);

    resultadoDiv.innerHTML = htmlEscala;
    document.getElementById('conteudo-popup').innerHTML = htmlPopup;

    // Salvar estado no localStorage
    const estadoSalvo = {
        ano,
        mes,
        totalMotoristas,
        htmlEscala,
        htmlPopup,
        estatisticas: gerenciador.estatisticas,
        contadorPlantao: gerenciador.contadorPlantao
    };
    localStorage.setItem('estadoEscala', JSON.stringify(estadoSalvo));

    // Mostrar resultados
    btnAbrirPopup.style.display = 'none';
    document.getElementById('popup-detalhes').classList.add('open');

    setTimeout(() => {
        document.getElementById('submit-loader').style.display = 'none';
    }, 600);
});

// ========================================
// FUNÇÕES DE GERAÇÃO DE HTML
// ========================================

function gerarHtmlEscala(escalaMes) {
    let html = '<table><thead><tr><th>Data</th><th>Dia</th><th>Plantão</th><th>Porta</th><th>BH</th><th>BD/DIV/MN/SL</th><th>Folga</th></tr></thead><tbody>';

    escalaMes.forEach(dia => {
        const data = dia.data;
        const nomeDia = data.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataFormatada = data.toLocaleDateString('pt-BR');
        const classeFimSemana = (dia.diaSemana === 0 || dia.diaSemana === 6) ? ' class="linha-fim-semana"' : '';

        const plantaoTexto = dia.plantao.length ? dia.plantao.join(' e ') : '-';
        const portaTexto = dia.porta.length ? dia.porta.join(' e ') : '-';
        const bhTexto = dia.bh.length ? dia.bh.join(' e ') : '-';
        const bddTexto = dia.bdd.length ? dia.bdd.join(' e ') : '-';
        const folgaTexto = dia.folgas.length ? dia.folgas.join(' e ') : '-';

        html += `<tr${classeFimSemana}>
            <td>${dataFormatada}</td>
            <td>${nomeDia}</td>
            <td>${plantaoTexto}</td>
            <td>${portaTexto}</td>
            <td>${bhTexto}</td>
            <td>${bddTexto}</td>
            <td>${folgaTexto}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    return html;
}

function gerarHtmlPopup(estatisticas, totalMotoristas) {
    let html = '<h3>📊 Estatísticas dos Motoristas (Mês Selecionado):</h3>';
    html += '<div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin: 10px 0;">';
    html += '<table><thead><tr><th>Motorista</th><th>Total de Horas</th><th>Detalhamento</th></tr></thead><tbody>';

    Object.keys(estatisticas.distribuicaoMotoristas).forEach(m => {
        const motorista = parseInt(m);
        const dados = estatisticas.distribuicaoMotoristas[m];

        let detalhamento = '';
        if (motorista <= 2) {
            detalhamento = `${dados.diasTrabalhados} plantões no mês`;
        } else {
            if (dados.plantoesFds > 0) {
                detalhamento = `${dados.funcoesSemana} funções + ${dados.plantoesFds} plantões FDS`;
            } else {
                detalhamento = `${dados.funcoesSemana} funções no mês`;
            }
        }

        html += `<tr>
            <td>Motorista ${m}</td>
            <td><strong>${dados.horasTrabalhadas} horas</strong></td>
            <td style="font-size: 12px; color: #666;">${detalhamento}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';

    // Estatísticas gerais do mês
    const horasIndividuais = Object.values(estatisticas.distribuicaoMotoristas).map(d => d.horasTrabalhadas);
    const totalHoras = horasIndividuais.reduce((sum, h) => sum + h, 0);
    const mediaHoras = (totalHoras / totalMotoristas).toFixed(1);
    const maxHoras = Math.max(...horasIndividuais);
    const minHoras = Math.min(...horasIndividuais);

    html += `<div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 6px;">`;
    html += `<p style="margin: 0; font-size: 12px;"><strong>📈 Estatísticas do Mês:</strong></p>`;
    html += `<p style="margin: 5px 0 0 0; font-size: 11px; color: #555;">Média: ${mediaHoras} horas • Maior: ${maxHoras} horas • Menor: ${minHoras} horas • Diferença: ${maxHoras - minHoras} horas</p>`;
    html += `</div>`;

    return html;
}

// ========================================
// GERENCIAMENTO DE POPUP
// ========================================

const btnAbrirPopup = document.getElementById('btn-abrir-popup');
const popupDetalhes = document.getElementById('popup-detalhes');

btnAbrirPopup.addEventListener('click', () => {
    popupDetalhes.classList.add('open');
    btnAbrirPopup.style.display = 'none';
});

function fecharPopup() {
    popupDetalhes.classList.remove('open');
    btnAbrirPopup.style.display = 'inline-block';
}

// ========================================
// MODAL DE CONFIRMAÇÃO RESET
// ========================================

document.getElementById('btn-resetar').addEventListener('click', function () {
    document.getElementById('modal-confirmacao').style.display = 'flex';
});

document.getElementById('cancelar-reset').addEventListener('click', function () {
    document.getElementById('modal-confirmacao').style.display = 'none';
});

document.getElementById('confirmar-reset').addEventListener('click', function () {
    localStorage.removeItem('estadoEscala');
    location.reload();
});

// ========================================
// CARREGAMENTO DE ESTADO SALVO
// ========================================

document.addEventListener('DOMContentLoaded', function () {
    const estadoSalvoJSON = localStorage.getItem('estadoEscala');
    if (estadoSalvoJSON) {
        const estadoSalvo = JSON.parse(estadoSalvoJSON);

        // Restaurar valores do formulário
        document.getElementById('ano').value = estadoSalvo.ano;
        document.getElementById('mes').value = estadoSalvo.mes + 1;
        document.getElementById('motoristas').value = estadoSalvo.totalMotoristas;

        // Restaurar resultados
        document.getElementById('resultado').innerHTML = estadoSalvo.htmlEscala;
        document.getElementById('conteudo-popup').innerHTML = estadoSalvo.htmlPopup;

        // Tornar o botão imprimir visível
        document.getElementById('btn-imprimir').style.display = 'inline-block';

        // Abrir popup automaticamente
        const btnAbrirPopup = document.getElementById('btn-abrir-popup');
        const popupDetalhes = document.getElementById('popup-detalhes');
        btnAbrirPopup.style.display = 'none';
        popupDetalhes.classList.add('open');
    }

    // Event listener para fechar popup
    const fecharBtn = document.getElementById('fechar-popup');
    if (fecharBtn) {
        fecharBtn.addEventListener('click', fecharPopup);
    }
});

// ========================================
// FUNÇÕES UTILITÁRIAS ADICIONAIS
// ========================================

// Função para debug - pode ser removida em produção
function debugEscala() {
    if (gerenciador.escalaAnual.length > 0) {
        console.log('Escala Anual Gerada:', gerenciador.escalaAnual.length, 'dias');
        console.log('Estado dos Motoristas:', gerenciador.estadoMotoristas);
        console.log('Estatísticas:', gerenciador.estatisticas);
    }
}

// Função para validar integridade da escala (opcional)
function validarIntegridade() {
    const problemas = [];

    for (let i = 1; i < gerenciador.escalaAnual.length; i++) {
        const hoje = gerenciador.escalaAnual[i];
        const ontem = gerenciador.escalaAnual[i - 1];

        // Verificar se alguém trabalhou no mesmo lugar dois dias seguidos
        const todasFuncoesHoje = [...hoje.plantao, ...hoje.porta, ...hoje.bh, ...hoje.bdd];
        const todasFuncoesOntem = [...ontem.plantao, ...ontem.porta, ...ontem.bh, ...ontem.bdd];

        const repeticoes = todasFuncoesHoje.filter(m => todasFuncoesOntem.includes(m));
        if (repeticoes.length > 0) {
            problemas.push(`Dia ${hoje.dia}/${hoje.mes + 1}: Motorista(s) ${repeticoes} trabalharam dias consecutivos`);
        }
    }

    if (problemas.length > 0) {
        console.warn('Problemas encontrados na escala:', problemas);
    } else {
        console.log('✅ Escala validada - sem problemas de integridade');
    }

    return problemas;
}


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

function testarTransicaoAnos() {
    // Gerar escala de teste
    const gerenciadorTeste = new GerenciadorEscala();
    gerenciadorTeste.gerarEscala4Anos(2025, 8);

    // Focar nos últimos dias de dezembro e primeiros de janeiro
    const ultimosDezembro = gerenciadorTeste.escalaAnual.filter(dia =>
        dia.data.getMonth() === 11 && dia.data.getDate() >= 28
    );

    const primeirosJaneiro = gerenciadorTeste.escalaAnual.filter(dia =>
        dia.data.getMonth() === 0 && dia.data.getDate() <= 5 && dia.data.getFullYear() === 2026
    );

    console.log('🗓️ Últimos dias de dezembro 2025:', ultimosDezembro);
    console.log('🗓️ Primeiros dias de janeiro 2026:', primeirosJaneiro);

    // Validar transições
    const problemasTransicao = gerenciadorTeste.validarTransicoes();
    const problemasViradaAno = problemasTransicao.filter(p =>
        p.data.includes('01/01/2026') || p.data.includes('02/01/2026')
    );

    if (problemasViradaAno.length > 0) {
        console.error('❌ Problemas na virada do ano:', problemasViradaAno);
    } else {
        console.log('✅ Transição entre anos validada - sem conflitos!');
    }

    return { ultimosDezembro, primeirosJaneiro, problemasViradaAno };
}