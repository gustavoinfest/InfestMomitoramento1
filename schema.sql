-- 1. MUNICIPIOS
CREATE TABLE municipios (
  codigo_ibge TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  uf TEXT NOT NULL,
  populacao INTEGER,
  porte_populacional INTEGER
);

-- 2. UNIDADES_SAUDE
CREATE TABLE unidades_saude (
  cnes TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT,
  municipio_codigo TEXT REFERENCES municipios(codigo_ibge),
  endereco TEXT
);

-- 3. EQUIPES
CREATE TABLE equipes (
  ine TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_equipe TEXT NOT NULL, -- eSF, eAP, eSB, eMulti
  carga_horaria INTEGER,
  cnes TEXT REFERENCES unidades_saude(cnes),
  municipio_codigo TEXT REFERENCES municipios(codigo_ibge),
  ativa BOOLEAN DEFAULT true
);

-- 4. PROFISSIONAIS
CREATE TABLE profissionais (
  cns TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cbo TEXT NOT NULL,
  equipe_ine TEXT REFERENCES equipes(ine),
  ativo BOOLEAN DEFAULT true
);

-- 5. CIDADÃOS (PACIENTES)
CREATE TABLE cidadaos (
  cpf TEXT PRIMARY KEY,
  cns TEXT UNIQUE,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  sexo TEXT,
  identidade_genero TEXT,
  raca_cor INTEGER,
  endereco TEXT,
  telefone TEXT,
  beneficiario_pbf BOOLEAN DEFAULT false,
  beneficiario_bpc BOOLEAN DEFAULT false,
  data_obito DATE,
  situacao TEXT DEFAULT 'ativo'
);

-- 6. VINCULOS (paciente ↔ equipe)
CREATE TABLE vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  equipe_ine TEXT REFERENCES equipes(ine),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  criterio_desempate TEXT,
  UNIQUE(cidadao_cpf, equipe_ine, data_inicio)
);

-- 7. INDICADORES (catálogo)
CREATE TABLE indicadores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  nota_referencia TEXT, -- B1, B2, C2, C3, etc
  categoria TEXT, -- saude_bucal, cuidado_integral, emulti
  formula TEXT,
  tipo_classificacao TEXT,
  parametros JSONB -- { otimo: { min, max }, bom: {...}, etc }
);

-- 8. BOAS_PRATICAS (por indicador)
CREATE TABLE boas_praticas (
  id TEXT PRIMARY KEY,
  indicador_id TEXT REFERENCES indicadores(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  pontos INTEGER NOT NULL,
  ordem INTEGER
);

-- 9. DADOS_BRUTOS_ATENDIMENTOS (importação do SIAPS)
CREATE TABLE dados_brutos_atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  profissional_cns TEXT REFERENCES profissionais(cns),
  equipe_ine TEXT REFERENCES equipes(ine),
  estabelecimento_cnes TEXT REFERENCES unidades_saude(cnes),
  data_atendimento DATE NOT NULL,
  tipo_atendimento TEXT, -- individual/odontologico/coletivo/domiciliar
  dados JSONB, -- armazena todos os campos originais
  competencia TEXT, -- YYYYMM
  data_importacao TIMESTAMP DEFAULT NOW()
);

-- 10. DADOS_BRUTOS_PROCEDIMENTOS
CREATE TABLE dados_brutos_procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  profissional_cns TEXT REFERENCES profissionais(cns),
  equipe_ine TEXT REFERENCES equipes(ine),
  data_procedimento DATE NOT NULL,
  sigtap_codigo TEXT,
  sigtap_descricao TEXT,
  competencia TEXT,
  data_importacao TIMESTAMP DEFAULT NOW()
);

-- 11. DADOS_BRUTOS_VACINACAO
CREATE TABLE dados_brutos_vacinacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  profissional_cns TEXT REFERENCES profissionais(cns),
  data_vacina DATE NOT NULL,
  vacina_codigo TEXT,
  vacina_descricao TEXT,
  dose TEXT,
  competencia TEXT,
  data_importacao TIMESTAMP DEFAULT NOW()
);

-- 12. DADOS_BRUTOS_VISITAS (ACS)
CREATE TABLE dados_brutos_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  profissional_cns TEXT REFERENCES profissionais(cns),
  equipe_ine TEXT REFERENCES equipes(ine),
  data_visita DATE NOT NULL,
  motivo TEXT,
  competencia TEXT,
  data_importacao TIMESTAMP DEFAULT NOW()
);

-- 13. DADOS_BRUTOS_CADASTRO
CREATE TABLE dados_brutos_cadastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  equipe_ine TEXT REFERENCES equipes(ine),
  data_cadastro DATE NOT NULL,
  data_atualizacao DATE,
  possui_cadastro_domiciliar BOOLEAN,
  possui_cadastro_individual BOOLEAN,
  competencia TEXT,
  data_importacao TIMESTAMP DEFAULT NOW()
);

-- 14. ACOMPANHAMENTO_INDIVIDUAL_PACIENTE (rastreabilidade)
CREATE TABLE acompanhamento_individual_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidadao_cpf TEXT REFERENCES cidadaos(cpf),
  competencia TEXT NOT NULL,
  indicador_id TEXT REFERENCES indicadores(id),
  boa_pratica_id TEXT REFERENCES boas_praticas(id),
  pontuacao_obtida INTEGER NOT NULL DEFAULT 0,
  cumprido BOOLEAN DEFAULT false,
  data_cumprimento DATE,
  evidencia JSONB, -- qual registro comprovou
  data_processamento TIMESTAMP DEFAULT NOW(),
  UNIQUE(cidadao_cpf, competencia, indicador_id, boa_pratica_id)
);

-- 15. RESULTADOS_INDICADORES_EQUIPE (agregado)
CREATE TABLE resultados_indicadores_equipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_ine TEXT REFERENCES equipes(ine),
  competencia TEXT NOT NULL,
  indicador_id TEXT REFERENCES indicadores(id),
  numerador INTEGER,
  denominador INTEGER,
  valor_calculado NUMERIC(10,2),
  classificacao TEXT,
  data_calculo TIMESTAMP DEFAULT NOW(),
  UNIQUE(equipe_ine, competencia, indicador_id)
);

-- 16. RESULTADOS_VINCULO_ACOMPANHAMENTO
CREATE TABLE resultados_vinculo_acompanhamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_ine TEXT REFERENCES equipes(ine),
  competencia TEXT NOT NULL,
  escore_cadastro NUMERIC(5,2),
  classificacao_cadastro TEXT,
  escore_acompanhamento NUMERIC(5,2),
  classificacao_acompanhamento TEXT,
  bônus_satisfacao NUMERIC(3,2),
  escore_final NUMERIC(5,2),
  classificacao_final TEXT,
  data_calculo TIMESTAMP DEFAULT NOW()
);

-- 17. LOGS_IMPORTACAO
CREATE TABLE logs_importacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_importacao TIMESTAMP DEFAULT NOW(),
  fonte TEXT NOT NULL, -- SIAPS_NOMINAL, SIAPS_AGRUPADO, ESUS_PEC
  competencia TEXT,
  registros_processados INTEGER,
  registros_inseridos INTEGER,
  registros_atualizados INTEGER,
  registros_erro INTEGER,
  status TEXT,
  erro TEXT,
  arquivo_nome TEXT
);

-- 18. LOGS_CRUZAMENTO
CREATE TABLE logs_cruzamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia TEXT,
  data_execucao TIMESTAMP DEFAULT NOW(),
  total_siaps INTEGER,
  total_esus INTEGER,
  cruzados INTEGER,
  nao_cruzados INTEGER,
  cpfs_nao_cruzados JSONB,
  status TEXT
);

-- 19. SIAPS_NOMINAL (Tabela auxiliar para importação)
CREATE TABLE siaps_nominal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia TEXT NOT NULL,
  cpf TEXT NOT NULL,
  cns TEXT,
  data_nascimento DATE,
  sexo TEXT,
  raca_cor INTEGER,
  cnes TEXT,
  ine TEXT,
  boas_praticas JSONB,
  nm BOOLEAN,
  dn BOOLEAN,
  data_importacao TIMESTAMP DEFAULT NOW(),
  UNIQUE(cpf, competencia)
);

-- 20. ESUS_PEC (Tabela auxiliar para importação)
CREATE TABLE esus_pec (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia TEXT NOT NULL,
  ine TEXT,
  cpf TEXT NOT NULL,
  nome TEXT,
  data_nascimento DATE,
  sexo TEXT,
  identidade_genero TEXT,
  telefone TEXT,
  endereco TEXT,
  data_atualizacao DATE,
  data_importacao TIMESTAMP DEFAULT NOW(),
  UNIQUE(cpf, ine, competencia)
);

-- Índices para consultas frequentes
CREATE INDEX idx_cidadaos_cpf ON cidadaos(cpf);
CREATE INDEX idx_cidadaos_cns ON cidadaos(cns);
CREATE INDEX idx_equipes_ine ON equipes(ine);
CREATE INDEX idx_equipes_tipo ON equipes(tipo_equipe);
CREATE INDEX idx_vinculos_cpf ON vinculos(cidadao_cpf);
CREATE INDEX idx_vinculos_ine ON vinculos(equipe_ine);
CREATE INDEX idx_vinculos_data ON vinculos(data_inicio, data_fim);
CREATE INDEX idx_acompanhamento_cpf_competencia ON acompanhamento_individual_paciente(cidadao_cpf, competencia);
CREATE INDEX idx_resultados_equipe_competencia ON resultados_indicadores_equipe(equipe_ine, competencia);
CREATE INDEX idx_dados_brutos_cpf_competencia ON dados_brutos_atendimentos(cidadao_cpf, competencia);
CREATE INDEX idx_dados_brutos_data ON dados_brutos_atendimentos(data_atendimento);

-- View para indicadores de saúde bucal (B1 a B6)
CREATE VIEW view_indicadores_saude_bucal AS
SELECT 
  equipe_ine,
  competencia,
  indicador_id,
  SUM(numerador) as numerador,
  SUM(denominador) as denominador,
  CASE 
    WHEN SUM(denominador) > 0 THEN (SUM(numerador)::NUMERIC / SUM(denominador)) * 100
    ELSE 0
  END as valor_calculado
FROM resultados_indicadores_equipe
WHERE indicador_id LIKE 'B%'
GROUP BY equipe_ine, competencia, indicador_id;

-- View para indicadores de cuidado integral (C2 a C7)
CREATE VIEW view_indicadores_cuidado_integral AS
SELECT 
  equipe_ine,
  competencia,
  indicador_id,
  SUM(pontuacao_obtida) as numerador,
  COUNT(DISTINCT cidadao_cpf) as denominador,
  CASE 
    WHEN COUNT(DISTINCT cidadao_cpf) > 0 THEN SUM(pontuacao_obtida)::NUMERIC / COUNT(DISTINCT cidadao_cpf)
    ELSE 0
  END as valor_calculado
FROM acompanhamento_individual_paciente a
JOIN boas_praticas b ON a.boa_pratica_id = b.id
WHERE b.indicador_id LIKE 'C%'
GROUP BY equipe_ine, competencia, indicador_id;

-- Função para calcular classificação do indicador
CREATE OR REPLACE FUNCTION calcular_classificacao(
  valor NUMERIC,
  parametros JSONB
) RETURNS TEXT AS $$
DECLARE
  otimo_min NUMERIC;
  otimo_max NUMERIC;
  bom_min NUMERIC;
  bom_max NUMERIC;
  suficiente_min NUMERIC;
  suficiente_max NUMERIC;
BEGIN
  otimo_min := (parametros->'otimo'->>'min')::NUMERIC;
  otimo_max := (parametros->'otimo'->>'max')::NUMERIC;
  bom_min := (parametros->'bom'->>'min')::NUMERIC;
  bom_max := (parametros->'bom'->>'max')::NUMERIC;
  suficiente_min := (parametros->'suficiente'->>'min')::NUMERIC;
  suficiente_max := (parametros->'suficiente'->>'max')::NUMERIC;
  
  IF valor >= otimo_min AND valor <= otimo_max THEN
    RETURN 'Ótimo';
  ELSIF valor >= bom_min AND valor <= bom_max THEN
    RETURN 'Bom';
  ELSIF valor >= suficiente_min AND valor <= suficiente_max THEN
    RETURN 'Suficiente';
  ELSE
    RETURN 'Regular';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular Componente Vínculo e Acompanhamento Territorial
CREATE OR REPLACE FUNCTION calcular_vinculo_acompanhamento(
  p_equipe_ine TEXT,
  p_competencia TEXT
) RETURNS TABLE (
  escore_cadastro NUMERIC,
  classificacao_cadastro TEXT,
  escore_acompanhamento NUMERIC,
  classificacao_acompanhamento TEXT,
  escore_final NUMERIC,
  classificacao_final TEXT
) AS $$
DECLARE
  v_populacao_parametro INTEGER := 3000; -- Exemplo: 3000 pessoas por eSF
  v_cadastros_validos INTEGER;
  v_acompanhamentos_validos INTEGER;
  v_cadastro_ponderado NUMERIC;
  v_acompanhamento_ponderado NUMERIC;
BEGIN
  -- 1. Contar cadastros válidos da equipe (simplificado)
  SELECT COUNT(DISTINCT cidadao_cpf) INTO v_cadastros_validos
  FROM vinculos
  WHERE equipe_ine = p_equipe_ine
  AND data_inicio <= CURRENT_DATE
  AND (data_fim IS NULL OR data_fim >= CURRENT_DATE);

  -- 2. Calcular Escore de Cadastro (0 a 10)
  v_cadastro_ponderado := LEAST((v_cadastros_validos::NUMERIC / v_populacao_parametro) * 10, 10.0);
  
  -- 3. Contar acompanhamentos válidos (simplificado)
  -- Considera pessoas com pelo menos 1 atendimento no semestre
  SELECT COUNT(DISTINCT cidadao_cpf) INTO v_acompanhamentos_validos
  FROM dados_brutos_atendimentos
  WHERE equipe_ine = p_equipe_ine
  AND data_atendimento >= CURRENT_DATE - INTERVAL '6 months';

  -- 4. Calcular Escore de Acompanhamento (0 a 10)
  -- Baseado na proporção de cadastrados que foram acompanhados
  IF v_cadastros_validos > 0 THEN
    v_acompanhamento_ponderado := LEAST((v_acompanhamentos_validos::NUMERIC / v_cadastros_validos) * 10, 10.0);
  ELSE
    v_acompanhamento_ponderado := 0;
  END IF;

  -- 5. Calcular Escore Final (Média ponderada ou simples, dependendo da regra exata)
  -- Aqui usamos média simples como exemplo
  escore_final := (v_cadastro_ponderado + v_acompanhamento_ponderado) / 2;

  -- 6. Definir classificações
  IF v_cadastro_ponderado >= 8 THEN classificacao_cadastro := 'Ótimo';
  ELSIF v_cadastro_ponderado >= 6 THEN classificacao_cadastro := 'Bom';
  ELSIF v_cadastro_ponderado >= 4 THEN classificacao_cadastro := 'Suficiente';
  ELSE classificacao_cadastro := 'Regular';
  END IF;

  IF v_acompanhamento_ponderado >= 8 THEN classificacao_acompanhamento := 'Ótimo';
  ELSIF v_acompanhamento_ponderado >= 6 THEN classificacao_acompanhamento := 'Bom';
  ELSIF v_acompanhamento_ponderado >= 4 THEN classificacao_acompanhamento := 'Suficiente';
  ELSE classificacao_acompanhamento := 'Regular';
  END IF;

  IF escore_final >= 8 THEN classificacao_final := 'Ótimo';
  ELSIF escore_final >= 6 THEN classificacao_final := 'Bom';
  ELSIF escore_final >= 4 THEN classificacao_final := 'Suficiente';
  ELSE classificacao_final := 'Regular';
  END IF;

  escore_cadastro := v_cadastro_ponderado;
  escore_acompanhamento := v_acompanhamento_ponderado;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Função para recalcular indicadores de um paciente
CREATE OR REPLACE FUNCTION recalcular_indicadores_paciente(
  p_cpf TEXT,
  p_competencia TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_registros_afetados INTEGER := 0;
  v_idade INTEGER;
  v_sexo TEXT;
  v_tem_hipertensao BOOLEAN;
  v_tem_diabetes BOOLEAN;
BEGIN
  -- Excluir registros existentes para a competência
  DELETE FROM acompanhamento_individual_paciente
  WHERE cidadao_cpf = p_cpf AND competencia = p_competencia;
  
  -- Obter dados básicos do cidadão
  SELECT 
    EXTRACT(YEAR FROM age(CURRENT_DATE, data_nascimento)),
    sexo
  INTO v_idade, v_sexo
  FROM cidadaos WHERE cpf = p_cpf;

  -- Exemplo: Indicador C5 (Citopatológico) - Mulheres de 25 a 64 anos
  IF v_sexo = 'F' AND v_idade >= 25 AND v_idade <= 64 THEN
    -- Verifica se fez o exame nos últimos 3 anos (simplificado)
    IF EXISTS (
      SELECT 1 FROM dados_brutos_procedimentos
      WHERE cidadao_cpf = p_cpf 
      AND sigtap_codigo IN ('0201020033', '0203010086') -- Códigos de citopatológico
      AND data_procedimento >= CURRENT_DATE - INTERVAL '3 years'
    ) THEN
      INSERT INTO acompanhamento_individual_paciente (
        cidadao_cpf, competencia, indicador_id, boa_pratica_id, pontuacao_obtida, cumprido, data_cumprimento
      ) VALUES (
        p_cpf, p_competencia, 'C5', 'BP_C5_1', 10, true, CURRENT_DATE
      );
      v_registros_afetados := v_registros_afetados + 1;
    END IF;
  END IF;

  -- Exemplo: Indicador C7 (Hipertensão)
  -- Verifica se tem diagnóstico de hipertensão (simplificado via CIAP2/CID10 em atendimentos)
  SELECT EXISTS (
    SELECT 1 FROM dados_brutos_atendimentos
    WHERE cidadao_cpf = p_cpf
    AND (dados->>'ciap2' LIKE '%K86%' OR dados->>'ciap2' LIKE '%K87%')
  ) INTO v_tem_hipertensao;

  IF v_tem_hipertensao THEN
    -- Verifica se teve PA aferida no semestre
    IF EXISTS (
      SELECT 1 FROM dados_brutos_atendimentos
      WHERE cidadao_cpf = p_cpf
      AND dados->>'pa_sistolica' IS NOT NULL
      AND data_atendimento >= CURRENT_DATE - INTERVAL '6 months'
    ) THEN
      INSERT INTO acompanhamento_individual_paciente (
        cidadao_cpf, competencia, indicador_id, boa_pratica_id, pontuacao_obtida, cumprido, data_cumprimento
      ) VALUES (
        p_cpf, p_competencia, 'C7', 'BP_C7_1', 10, true, CURRENT_DATE
      );
      v_registros_afetados := v_registros_afetados + 1;
    END IF;
  END IF;

  -- Lógica similar deve ser implementada para C2, C3, C4, C6 e B1-B6
  -- ...
  
  RETURN v_registros_afetados;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS em todas as tabelas
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidadaos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acompanhamento_individual_paciente ENABLE ROW LEVEL SECURITY;

-- Políticas para ADMIN (acesso total)
CREATE POLICY admin_all ON municipios FOR ALL TO authenticated
  USING (auth.role() = 'admin');

-- Políticas para GESTOR MUNICIPAL (apenas seu município)
CREATE POLICY gestor_municipal ON unidades_saude FOR SELECT TO authenticated
  USING (municipio_codigo IN (
    SELECT municipio_codigo FROM usuarios WHERE auth.uid() = id
  ));

-- Políticas para COORDENADOR APS (apenas suas equipes)
CREATE POLICY coordenador_aps ON equipes FOR SELECT TO authenticated
  USING (ine IN (
    SELECT equipe_ine FROM usuarios_equipes WHERE auth.uid() = usuario_id
  ));
