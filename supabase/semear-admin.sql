-- ============================================================================
-- CONTA DE ARRANQUE DO PAINEL
-- ----------------------------------------------------------------------------
-- Corre este ficheiro DEPOIS de `schema-ugp.sql`, uma vez só.
--
-- A palavra-passe não está aqui: está aqui a derivação PBKDF2-SHA256 com
-- 120.000 iterações, no formato "iteracoes.sal.derivada" que o
-- src/lib/auth.ts sabe conferir. Mesmo com esta linha na mão, ninguém
-- recupera a palavra-passe original.
--
-- Ainda assim: TROCA A PALAVRA-PASSE depois do primeiro acesso, em
-- /admin/perfil. Esta derivação vive no repositório, e um repositório muda
-- de mãos mais vezes do que uma palavra-passe devia.
--
-- O `on conflict do nothing` faz com que correr isto duas vezes não estrague
-- nada nem reponha a palavra-passe de quem já a trocou.
-- ============================================================================

insert into public.utilizadores_painel
  (utilizador, nome, email, papel, activo, palavra_passe_hash, deve_trocar_palavra_passe)
values (
  'admin',
  'Administrador',
  'leonildo.caculo@gmail.com',
  'admin',
  true,
  '120000.E6hsqPyBfryHHGk7aJJl9Q.D-VCBLZeMvFcereeGpRwSsVAWeQThrL9XIA5FZIa5Hw',
  false
)
on conflict (utilizador) do nothing;

select utilizador, nome, email, papel, activo from public.utilizadores_painel;
