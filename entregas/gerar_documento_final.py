#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gerador do documento final (.docx) da APS - Monitoramento de transporte publico em SP.

COMO USAR
=========
Pre-requisito (a instalacao do python-docx NAO persiste entre sessoes,
entao reinstale sempre que necessario):

    python3 -m pip install python-docx

Depois, a partir da raiz do repositorio, execute:

    python3 entregas/gerar_documento_final.py

O script grava (substituindo o arquivo antigo):

    entregas/APS_Documento_Final_Transporte_Publico_SP.docx

E reexecutavel: rodar duas vezes produz o mesmo .docx sem erro.

ABORDAGEM ESCOLHIDA
===================
O conteudo das secoes NAO e duplicado aqui. O script LE os arquivos Markdown
numerados em docs/ (fonte unica de verdade) e converte um subconjunto de
Markdown (titulos #/##/###, paragrafos, listas com - e 1., tabelas simples com
pipe |, blocos de codigo entre ```, citacoes com >, negrito **...** e links
[texto](url)) para elementos do .docx. Assim, quando a documentacao em docs/ e
atualizada, basta reexecutar este script para regenerar o documento final, sem
risco de texto duplicado ou divergente dentro do proprio gerador.

A CAPA e a FICHA DE APS sao montadas a partir de docs/10_capa_e_ficha_aps.md
(capa no inicio; ficha ao final). O SUMARIO e inserido como campo TOC do Word
(via XML); ao abrir no Word/LibreOffice, o usuario deve clicar com o botao
direito sobre o sumario e escolher "Atualizar campo" para preencher as paginas.

FORMATACAO OBRIGATORIA (manual da APS, tem precedencia)
=======================================================
- Fonte Arial tamanho 12 no estilo Normal (ascii/hAnsi/eastAsia/cs).
- Espacamento entre linhas 1,5.
- Margens esquerda = direita = topo = inferior = 2,5 cm.
- Pagina A4 retrato (21 cm x 29,7 cm).
- Corpo de texto justificado; titulos usam estilos Heading (alimentam o sumario).
- Numeracao de paginas no rodape (campo PAGE via XML).
"""

import os
import re

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ----------------------------------------------------------------------------
# Caminhos
# ----------------------------------------------------------------------------
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DOCS = os.path.join(RAIZ, "docs")
SAIDA = os.path.join(AQUI, "APS_Documento_Final_Transporte_Publico_SP.docx")

FONTE = "Arial"
TAMANHO = 12

# Dados do grupo (fonte: docs/10 e context.json). A capa usa acentuacao correta.
INSTITUICAO = "Universidade Paulista (UNIP)"
CURSO = "Ciência da Computação"
DISCIPLINA = "Sistemas Distribuídos (SD)"
SEMESTRE = "7º / 8º"
ANO = "2025"
TITULO = (
    "Desenvolvimento de uma aplicação de sistema distribuído para dispositivo móvel "
    "- Monitoramento de transporte público em SP"
)
INTEGRANTES = [
    "David Andrew Dezidério Gomes Silva - RA F3530E8",
    "Carlos Henrique Santana Rodrigues - RA R013944",
    "Henrique Vitale Cassú - RA N916FJ2",
    "Marcelo Augusto de Souza Silva - RA F356JE0",
]

# Ordem exigida pelo manual. As secoes 01..08 sao o corpo principal; depois vem
# os extras (09, 11, 12, 13) e, por ultimo, a Ficha de APS (de docs/10).
# docs/10 e tratado a parte (capa no inicio, ficha ao final).
ARQUIVOS_CORPO = [
    "01_objetivo_e_motivacao.md",
    "02_introducao.md",
    "03_fundamentos_tecnologias_moveis.md",
    "04_plano_de_desenvolvimento.md",
    "05_projeto_estrutura_e_modulos.md",
    "06_relatorio_de_codigo.md",
    "07_apresentacao_do_programa.md",
    "08_bibliografia.md",
    "09_declaracao_uso_ia.md",
    "11_licencas_e_atribuicoes.md",
    "12_politica_de_privacidade.md",
    "13_termos_de_uso.md",
]


# ----------------------------------------------------------------------------
# Estilo global (Arial 12, espacamento 1,5, margens 2,5 cm, A4)
# ----------------------------------------------------------------------------
def _forcar_fonte_em_todos_os_scripts(fonte_element, nome):
    """Define ascii/hAnsi/eastAsia/cs para garantir Arial em qualquer run."""
    rpr = fonte_element
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), nome)


def configurar_estilo_normal(doc):
    estilo = doc.styles["Normal"]
    estilo.font.name = FONTE
    estilo.font.size = Pt(TAMANHO)
    # Garante Arial em todos os scripts (ascii/hAnsi/eastAsia/cs).
    rpr = estilo.element.get_or_add_rPr()
    _forcar_fonte_em_todos_os_scripts(rpr, FONTE)
    pf = estilo.paragraph_format
    pf.line_spacing = 1.5
    pf.space_after = Pt(6)


def configurar_secao(section):
    # A4 retrato.
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    # Margens 2,5 cm em todos os lados.
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)


def aplicar_arial_no_run(run):
    run.font.name = FONTE
    run.font.size = Pt(TAMANHO)
    rpr = run._element.get_or_add_rPr()
    _forcar_fonte_em_todos_os_scripts(rpr, FONTE)


# ----------------------------------------------------------------------------
# Numeracao de paginas (campo PAGE via XML no rodape)
# ----------------------------------------------------------------------------
def adicionar_numeracao_rodape(section):
    footer = section.footer
    footer.is_linked_to_previous = False
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.text = ""
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    def _run_campo(texto_instrucao=None, tipo=None):
        run = p.add_run()
        aplicar_arial_no_run(run)
        el = OxmlElement("w:fldChar")
        el.set(qn("w:fldCharType"), tipo)
        run._element.append(el)
        return run

    # "Pagina X de Y"
    r0 = p.add_run("Pagina ")
    aplicar_arial_no_run(r0)
    _run_campo(tipo="begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    rinstr = p.add_run()
    aplicar_arial_no_run(rinstr)
    rinstr._element.append(instr)
    _run_campo(tipo="end")

    rde = p.add_run(" de ")
    aplicar_arial_no_run(rde)
    _run_campo(tipo="begin")
    instr2 = OxmlElement("w:instrText")
    instr2.set(qn("xml:space"), "preserve")
    instr2.text = "NUMPAGES"
    rinstr2 = p.add_run()
    aplicar_arial_no_run(rinstr2)
    rinstr2._element.append(instr2)
    _run_campo(tipo="end")


# ----------------------------------------------------------------------------
# Sumario (campo TOC via XML)
# ----------------------------------------------------------------------------
def adicionar_sumario(doc):
    paragrafo = doc.add_paragraph()
    run = paragrafo.add_run()
    aplicar_arial_no_run(run)
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    run._element.append(fld_begin)

    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    # Sumario a partir dos niveis de titulo 1 a 3.
    instr.text = r'TOC \o "1-3" \h \z \u'
    run._element.append(instr)

    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    run._element.append(fld_sep)

    aviso = OxmlElement("w:t")
    aviso.text = (
        "Sumario: abra no Word/LibreOffice, clique com o botao direito e "
        "escolha 'Atualizar campo' para gerar as paginas."
    )
    run._element.append(aviso)

    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._element.append(fld_end)


# ----------------------------------------------------------------------------
# Conversor de Markdown basico -> paragrafos .docx
# ----------------------------------------------------------------------------
PADRAO_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
PADRAO_NEGRITO = re.compile(r"\*\*([^*]+)\*\*")
PADRAO_CODIGO_INLINE = re.compile(r"`([^`]+)`")


def _escrever_inline(paragrafo, texto):
    """Converte **negrito**, `codigo` e [texto](url) em runs.

    Links viram apenas o texto visivel seguido da URL entre parenteses, para
    manter a leitura em papel (impressao da APS).
    """
    texto = PADRAO_LINK.sub(lambda m: f"{m.group(1)} ({m.group(2)})", texto)

    # Divide por negrito e codigo inline preservando os delimitadores.
    partes = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", texto)
    for parte in partes:
        if not parte:
            continue
        if parte.startswith("**") and parte.endswith("**"):
            run = paragrafo.add_run(parte[2:-2])
            run.bold = True
            aplicar_arial_no_run(run)
        elif parte.startswith("`") and parte.endswith("`"):
            run = paragrafo.add_run(parte[1:-1])
            run.font.name = "Courier New"
            run.font.size = Pt(TAMANHO - 1)
            rpr = run._element.get_or_add_rPr()
            _forcar_fonte_em_todos_os_scripts(rpr, "Courier New")
        else:
            run = paragrafo.add_run(parte)
            aplicar_arial_no_run(run)


def _nivel_heading(linha):
    m = re.match(r"^(#{1,6})\s+(.*)$", linha)
    if not m:
        return None, None
    return len(m.group(1)), m.group(2).strip()


def _eh_separador_tabela(linha):
    conteudo = linha.strip().strip("|")
    celulas = [c.strip() for c in conteudo.split("|")]
    return bool(celulas) and all(re.fullmatch(r":?-{2,}:?", c) for c in celulas if c != "")


def _celulas(linha):
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def adicionar_tabela(doc, linhas_tabela):
    cabecalho = _celulas(linhas_tabela[0])
    corpo = [_celulas(l) for l in linhas_tabela[2:]]
    n_col = len(cabecalho)
    tabela = doc.add_table(rows=1, cols=n_col)
    tabela.style = "Table Grid"
    hdr = tabela.rows[0].cells
    for i, texto in enumerate(cabecalho):
        if i < n_col:
            hdr[i].paragraphs[0].text = ""
            _escrever_inline(hdr[i].paragraphs[0], texto)
            for run in hdr[i].paragraphs[0].runs:
                run.bold = True
    for linha in corpo:
        celulas = tabela.add_row().cells
        for i in range(n_col):
            valor = linha[i] if i < len(linha) else ""
            celulas[i].paragraphs[0].text = ""
            _escrever_inline(celulas[i].paragraphs[0], valor)


def adicionar_bloco_codigo(doc, linhas_codigo):
    for linha in linhas_codigo:
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(linha if linha else " ")
        run.font.name = "Courier New"
        run.font.size = Pt(TAMANHO - 2)
        rpr = run._element.get_or_add_rPr()
        _forcar_fonte_em_todos_os_scripts(rpr, "Courier New")


def converter_markdown(doc, texto, deslocamento_heading=0, pular_primeiro_h1=False):
    """Converte o Markdown de um documento docs/ em elementos .docx.

    deslocamento_heading: soma ao nivel do heading (para rebaixar titulos).
    pular_primeiro_h1: usado quando o H1 ja virou titulo de secao externamente.
    """
    linhas = texto.splitlines()
    i = 0
    n = len(linhas)
    primeiro_h1_pulado = not pular_primeiro_h1

    while i < n:
        linha = linhas[i]

        # Bloco de codigo ``` ... ```
        if linha.strip().startswith("```"):
            i += 1
            buffer = []
            while i < n and not linhas[i].strip().startswith("```"):
                buffer.append(linhas[i])
                i += 1
            i += 1  # pula o ``` final
            adicionar_bloco_codigo(doc, buffer)
            continue

        # Tabela (linha com | seguida de separador ---)
        if "|" in linha and i + 1 < n and _eh_separador_tabela(linhas[i + 1]):
            bloco = [linha, linhas[i + 1]]
            i += 2
            while i < n and "|" in linhas[i] and linhas[i].strip():
                bloco.append(linhas[i])
                i += 1
            adicionar_tabela(doc, bloco)
            continue

        # Heading
        nivel, conteudo = _nivel_heading(linha)
        if nivel is not None:
            if nivel == 1 and not primeiro_h1_pulado:
                primeiro_h1_pulado = True
                i += 1
                continue
            nivel_final = min(nivel + deslocamento_heading, 9)
            p = doc.add_heading(level=max(nivel_final, 1))
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            _escrever_inline(p, conteudo)
            for run in p.runs:
                run.font.name = FONTE
                rpr = run._element.get_or_add_rPr()
                _forcar_fonte_em_todos_os_scripts(rpr, FONTE)
            i += 1
            continue

        # Citacao (>)
        if linha.strip().startswith(">"):
            conteudo_cit = re.sub(r"^\s*>\s?", "", linha)
            p = doc.add_paragraph(style="Intense Quote")
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            _escrever_inline(p, conteudo_cit)
            i += 1
            continue

        # Lista nao ordenada
        m_ul = re.match(r"^(\s*)[-*]\s+(.*)$", linha)
        if m_ul:
            p = doc.add_paragraph(style="List Bullet")
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            _escrever_inline(p, m_ul.group(2))
            i += 1
            continue

        # Lista ordenada
        m_ol = re.match(r"^(\s*)\d+\.\s+(.*)$", linha)
        if m_ol:
            p = doc.add_paragraph(style="List Number")
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            _escrever_inline(p, m_ol.group(2))
            i += 1
            continue

        # Linha em branco
        if not linha.strip():
            i += 1
            continue

        # Paragrafo comum: junta linhas consecutivas ate uma quebra
        buffer = [linha]
        i += 1
        while i < n and linhas[i].strip() and not _inicio_de_bloco(linhas[i], linhas, i):
            buffer.append(linhas[i])
            i += 1
        paragrafo_texto = " ".join(s.strip() for s in buffer)
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        _escrever_inline(p, paragrafo_texto)


def _inicio_de_bloco(linha, linhas, i):
    """Detecta se a linha inicia um novo bloco (nao faz parte do paragrafo)."""
    if _nivel_heading(linha)[0] is not None:
        return True
    if linha.strip().startswith("```"):
        return True
    if linha.strip().startswith(">"):
        return True
    if re.match(r"^\s*[-*]\s+", linha):
        return True
    if re.match(r"^\s*\d+\.\s+", linha):
        return True
    if "|" in linha and i + 1 < len(linhas) and _eh_separador_tabela(linhas[i + 1]):
        return True
    return False


# ----------------------------------------------------------------------------
# Secoes especiais: capa e ficha (de docs/10)
# ----------------------------------------------------------------------------
def montar_capa(doc):
    def titulo_centralizado(texto, tamanho, negrito=True, espaco_antes=0, espaco_depois=6):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.space_before = Pt(espaco_antes)
        pf.space_after = Pt(espaco_depois)
        run = p.add_run(texto)
        run.bold = negrito
        run.font.name = FONTE
        run.font.size = Pt(tamanho)
        rpr = run._element.get_or_add_rPr()
        _forcar_fonte_em_todos_os_scripts(rpr, FONTE)
        return p

    titulo_centralizado(INSTITUICAO.upper(), 14, espaco_depois=2)
    titulo_centralizado(f"Curso: {CURSO}", 12, negrito=False, espaco_depois=2)
    titulo_centralizado(f"Disciplina: {DISCIPLINA}", 12, negrito=False, espaco_depois=2)
    titulo_centralizado(f"Semestre: {SEMESTRE}", 12, negrito=False, espaco_depois=24)

    titulo_centralizado("Atividades Práticas Supervisionadas (APS)", 13, espaco_depois=36)

    titulo_centralizado(TITULO, 14, espaco_antes=24, espaco_depois=36)

    titulo_centralizado("Alunos e RA:", 12, espaco_antes=24, espaco_depois=4)
    for integrante in INTEGRANTES:
        titulo_centralizado(integrante, 12, negrito=False, espaco_depois=2)

    titulo_centralizado(
        "Professor(a) orientador(a): [preencher pelo autor]", 12, negrito=False,
        espaco_antes=36, espaco_depois=2,
    )
    titulo_centralizado("Polo / Campus: [preencher pelo autor]", 12, negrito=False, espaco_depois=2)
    titulo_centralizado("Turma: [preencher pelo autor]", 12, negrito=False, espaco_depois=2)
    titulo_centralizado("Data de entrega: [preencher pelo autor]", 12, negrito=False, espaco_depois=2)
    titulo_centralizado("Cidade / UF: São Paulo / SP", 12, negrito=False, espaco_depois=2)
    titulo_centralizado(f"Ano: {ANO}", 12, negrito=False, espaco_depois=2)


def extrair_ficha(texto_doc10):
    """Extrai apenas a secao '10.2 Ficha de APS' de docs/10 para o final."""
    linhas = texto_doc10.splitlines()
    inicio = None
    fim = len(linhas)
    for idx, l in enumerate(linhas):
        if re.match(r"^##\s+10\.2", l):
            inicio = idx
        elif inicio is not None and re.match(r"^##\s+10\.3", l):
            fim = idx
            break
    if inicio is None:
        return ""
    return "\n".join(linhas[inicio:fim])


def ler(nome):
    with open(os.path.join(DOCS, nome), encoding="utf-8") as fh:
        return fh.read()


def quebra_de_pagina(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


# ----------------------------------------------------------------------------
# Montagem do documento
# ----------------------------------------------------------------------------
def gerar():
    doc = Document()
    configurar_estilo_normal(doc)

    secao_inicial = doc.sections[0]
    configurar_secao(secao_inicial)
    adicionar_numeracao_rodape(secao_inicial)

    # (1) CAPA
    montar_capa(doc)
    quebra_de_pagina(doc)

    # (2) SUMARIO / INDICE
    titulo_sumario = doc.add_heading("Sumario", level=1)
    titulo_sumario.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in titulo_sumario.runs:
        run.font.name = FONTE
        rpr = run._element.get_or_add_rPr()
        _forcar_fonte_em_todos_os_scripts(rpr, FONTE)
    adicionar_sumario(doc)
    quebra_de_pagina(doc)

    # (3)..(10) + extras: corpo a partir dos .md (cada H1 vira titulo nivel 1).
    for indice, nome in enumerate(ARQUIVOS_CORPO):
        texto = ler(nome)
        converter_markdown(doc, texto, deslocamento_heading=0, pular_primeiro_h1=False)
        if indice < len(ARQUIVOS_CORPO) - 1:
            quebra_de_pagina(doc)

    # FICHA DE APS ao final (de docs/10)
    quebra_de_pagina(doc)
    ficha = extrair_ficha(ler("10_capa_e_ficha_aps.md"))
    h = doc.add_heading("Ficha de APS", level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in h.runs:
        run.font.name = FONTE
        rpr = run._element.get_or_add_rPr()
        _forcar_fonte_em_todos_os_scripts(rpr, FONTE)
    # Remove o proprio H2 "10.2 Ficha de APS" (ja viramos o titulo acima).
    ficha = re.sub(r"^##\s+10\.2.*$", "", ficha, count=1, flags=re.MULTILINE)
    converter_markdown(doc, ficha, deslocamento_heading=1, pular_primeiro_h1=False)

    doc.save(SAIDA)
    return doc


def main():
    gerar()
    print(f"Documento gerado em: {SAIDA}")

    # Sanity check: reabre e valida a formatacao obrigatoria.
    d = Document(SAIDA)
    s = d.sections[0]
    print("A4 (cm):", round(s.page_width / Cm(1), 1), "x", round(s.page_height / Cm(1), 1))
    print(
        "Margens L/R/T/B (cm):",
        round(s.left_margin / Cm(1), 2),
        round(s.right_margin / Cm(1), 2),
        round(s.top_margin / Cm(1), 2),
        round(s.bottom_margin / Cm(1), 2),
    )
    normal = d.styles["Normal"]
    print("Fonte Normal:", normal.font.name, normal.font.size.pt if normal.font.size else None)
    print("line_spacing Normal:", normal.paragraph_format.line_spacing)
    headings = [p.text for p in d.paragraphs if p.style.name.startswith("Heading 1")]
    print("Titulos nivel 1:", headings)
    print("Total de paragrafos:", len(d.paragraphs))


if __name__ == "__main__":
    main()
