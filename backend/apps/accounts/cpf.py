def somente_digitos(valor: str) -> str:
    return ''.join(caractere for caractere in str(valor or '') if caractere.isdigit())


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False

    def digito(base: str, peso_inicial: int) -> int:
        total = sum(int(numero) * peso for numero, peso in zip(base, range(peso_inicial, 1, -1)))
        resto = (total * 10) % 11
        return 0 if resto == 10 else resto

    if digito(digitos[:9], 10) != int(digitos[9]):
        return False
    return digito(digitos[:10], 11) == int(digitos[10])


def formatar_cpf(valor: str) -> str:
    digitos = somente_digitos(valor)
    if len(digitos) != 11:
        return ''
    return f'{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}'
