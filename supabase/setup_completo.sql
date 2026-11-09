-- ============================================================================
-- SCRIPT DESCONTINUADO (NÃO EXECUTAR)
-- ============================================================================
-- Este arquivo criava políticas RLS amplas (using/with check = true) para
-- qualquer usuário autenticado e permitia leitura/inserção livre na auditoria.
-- Ele foi substituído pelas migrations em supabase/migrations/, que são a
-- fonte única de verdade para schema, RLS, papéis e Storage.
--
-- Execute as migrations na ordem indicada no README.md. Para segurança, este
-- script agora falha de propósito em vez de aplicar uma configuração insegura.
-- ============================================================================

do $$
begin
  raise exception
    'setup_completo.sql foi descontinuado por motivos de segurança. Execute as migrations de supabase/migrations/ na ordem indicada no README.md.';
end
$$;
