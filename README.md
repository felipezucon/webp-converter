# Conversor WebP

Ferramenta estática para converter PNG, JPG e JPEG em WebP no próprio navegador.

## Consumo da VPS

Depois de carregada, a conversão acontece no computador/celular do usuário usando Canvas. A VPS serve apenas três arquivos estáticos, portanto o consumo de CPU, memória e armazenamento é praticamente zero e as imagens não ficam salvas no servidor. O navegador usa memória temporária proporcional às imagens abertas.

## Publicar no Coolify

1. Coloque esta pasta em um repositório Git (por exemplo, GitHub).
2. No Coolify, crie **New Resource → Application → Git Repository** e selecione o repositório.
3. Em **Build Pack**, selecione **Dockerfile**.
4. Use a raiz do projeto (ou informe o caminho desta pasta, se ela estiver dentro de um monorepo).
5. Publique a aplicação na porta **80** e adicione seu domínio.
6. Ative HTTPS pelo próprio Coolify.

O `Dockerfile` já usa Nginx Alpine e não precisa de banco, volume ou variáveis de ambiente.

## Testar localmente

Com Docker instalado:

```bash
docker build -t conversor-webp .
docker run --rm -p 8080:80 conversor-webp
```

Acesse http://localhost:8080.

## Uso

Escolha ou arraste uma ou várias imagens, ajuste a qualidade (82% é um bom ponto de partida), opcionalmente defina uma largura máxima e clique em **Baixar**. Para imagens com texto ou transparência, revise visualmente o WebP antes de substituir o original.
