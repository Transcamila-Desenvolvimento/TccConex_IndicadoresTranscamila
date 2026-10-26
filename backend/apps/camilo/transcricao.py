"""Tira da transcrição o trecho que o navegador cola de novo ao religar o microfone."""


def _hash_palavra(palavra: str) -> int:
    valor = 0
    for caractere in palavra.lower():
        valor = (valor * 33 + ord(caractere)) & 0xFFFFFFFF
    return valor + 1


def _prefixos(palavras: list[str]) -> tuple[list[int], list[int]]:
    base = 131
    mascara = (1 << 64) - 1
    pref = [0]
    pot = [1]
    for palavra in palavras:
        pref.append((pref[-1] * base + _hash_palavra(palavra)) & mascara)
        pot.append((pot[-1] * base) & mascara)
    return pref, pot


def _faixa(pref: list[int], pot: list[int], inicio: int, fim: int) -> int:
    mascara = (1 << 64) - 1
    return (pref[fim] - pref[inicio] * pot[fim - inicio]) & mascara


def colapsar_transcricao(texto: str) -> str:
    """Uma frase repetida em seguida vira uma só. O restante da fala permanece."""
    palavras = ' '.join((texto or '').split()).split()
    if len(palavras) < 4:
        return ' '.join(palavras)
    sem_gagueira = []
    for palavra in palavras:
        if (
            len(sem_gagueira) >= 2
            and sem_gagueira[-1].lower() == palavra.lower() == sem_gagueira[-2].lower()
        ):
            continue
        sem_gagueira.append(palavra)
    palavras = sem_gagueira
    if len(palavras) < 8:
        return ' '.join(palavras)

    pref, pot = _prefixos(palavras)
    saida: list[str] = []
    pref_s = [0]
    pot_s = [1]
    base = 131
    mascara = (1 << 64) - 1
    i = 0
    n = len(palavras)
    while i < n:
        limite = min(len(saida), n - i, 2000)
        pulou = False
        if limite >= 8:
            k = limite
            while k >= 8:
                if (
                    saida[-k].lower() == palavras[i].lower()
                    and saida[-1].lower() == palavras[i + k - 1].lower()
                    and _faixa(pref_s, pot_s, len(saida) - k, len(saida)) == _faixa(pref, pot, i, i + k)
                ):
                    i += k
                    pulou = True
                    break
                k = k // 2 if k > 256 else k - 1
        if pulou:
            continue
        if limite >= 2:
            curto = min(limite, 6)
            for k in range(curto, 1, -1):
                if saida[-k].lower() != palavras[i].lower():
                    continue
                if _faixa(pref_s, pot_s, len(saida) - k, len(saida)) != _faixa(pref, pot, i, i + k):
                    continue
                copias = 1
                while (
                    i + (copias + 1) * k <= n
                    and _faixa(pref, pot, i, i + k) == _faixa(pref, pot, i + copias * k, i + (copias + 1) * k)
                ):
                    copias += 1
                if copias >= 3:
                    i += k * (copias - 1)
                    pulou = True
                    break
                continue
        if pulou:
            continue
        valor = _hash_palavra(palavras[i])
        pref_s.append((pref_s[-1] * base + valor) & mascara)
        pot_s.append((pot_s[-1] * base) & mascara)
        saida.append(palavras[i])
        i += 1
    return ' '.join(saida)
