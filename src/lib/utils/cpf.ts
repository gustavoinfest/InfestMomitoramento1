export function normalizarCPF(cpf: string): string {
  const clean = String(cpf || '').replace(/\D/g, '').trim();
  if (clean.length > 0 && clean.length < 11) {
    return clean.padStart(11, '0');
  }
  return clean;
}

export function formatarCPF(cpf: string): string {
  const numeros = cpf.replace(/\D/g, '')
  if (numeros.length !== 11) return cpf
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validarCPF(cpf: string): boolean {
  const numeros = normalizarCPF(cpf)
  if (numeros.length !== 11) return false
  if (/^(\d)\1{10}$/.test(numeros)) return false
  
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(numeros.charAt(i)) * (10 - i)
  }
  let resto = 11 - (soma % 11)
  let digito = resto >= 10 ? 0 : resto
  if (digito !== parseInt(numeros.charAt(9))) return false
  
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(numeros.charAt(i)) * (11 - i)
  }
  resto = 11 - (soma % 11)
  digito = resto >= 10 ? 0 : resto
  return digito === parseInt(numeros.charAt(10))
}

export function extrairCPFDoTexto(texto: string): string | null {
  const match = texto.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
  if (match) {
    return normalizarCPF(match[0])
  }
  return null
}
