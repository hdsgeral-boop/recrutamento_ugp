import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/auth";
import { pode } from "@/lib/permissoes";

/**
 * Protege tudo o que está debaixo de /admin.
 * Sem cookie válido, manda para /admin/login guardando o destino original.
 *
 * A gestão de utilizadores e as definições ficam barradas aqui, à entrada, a
 * quem não tiver a capacidade - e voltam a ser confirmadas dentro de cada
 * Server Action, que é onde a segurança tem mesmo de estar.
 */
export async function middleware(pedido: NextRequest) {
  const { pathname, search } = pedido.nextUrl;

  // A página de login e a acção de autenticação têm de ficar abertas.
  if (pathname === "/admin/login") return NextResponse.next();

  const sessao = await lerSessao(pedido.cookies.get(COOKIE_SESSAO)?.value);

  if (sessao) {
    // Enquanto a palavra-passe for a que o sistema gerou, o painel inteiro
    // está fechado: só se pode trocá-la ou sair. Isto vale também para as
    // rotas de API, senão uma conta por estrear exportava o Excel com os
    // dados pessoais de toda a gente.
    if (sessao.deveTrocar && pathname !== "/admin/trocar-palavra-passe") {
      const destino = pedido.nextUrl.clone();
      destino.pathname = "/admin/trocar-palavra-passe";
      destino.search = "";
      return NextResponse.redirect(destino);
    }

    // As páginas com dono: quem não tem a capacidade nem chega a abri-las.
    const barrada =
      (pathname.startsWith("/admin/utilizadores") && !pode(sessao.papel, "gerir_utilizadores")) ||
      (pathname.startsWith("/admin/definicoes") && !pode(sessao.papel, "configurar"));

    if (barrada) {
      const destino = pedido.nextUrl.clone();
      destino.pathname = "/admin";
      destino.search = "?semPermissao=1";
      return NextResponse.redirect(destino);
    }

    return NextResponse.next();
  }

  const destino = pedido.nextUrl.clone();
  destino.pathname = "/admin/login";
  destino.search = `?voltar=${encodeURIComponent(pathname + search)}`;

  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
