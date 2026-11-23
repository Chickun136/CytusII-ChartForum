import { getChartPageSvg } from '@/lib/chart-service.mjs';

export async function GET(
  request: Request,
  context: { params: Promise<{ chartId: string; page: string }> },
) {
  const { chartId, page } = await context.params;
  const pageIndex = Number(page);

  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return Response.json({ error: '页码必须是大于等于 0 的整数' }, { status: 400 });
  }

  try {
    const result = await getChartPageSvg(chartId, pageIndex);
    if (!result) {
      return Response.json({ error: '页码超出谱面范围' }, { status: 404 });
    }

    const headers = {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      ETag: result.etag,
      'X-Chart-Cache': result.cached ? 'HIT' : 'MISS',
    };

    if (request.headers.get('if-none-match') === result.etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(result.svg, { status: 200, headers });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException & { code?: string }).code;
    if (code === 'INVALID_CHART_ID' || code === 'INVALID_PAGE') {
      return Response.json({ error: '谱面 ID 或页码不合法' }, { status: 400 });
    }
    if (code === 'ENOENT') {
      return Response.json({ error: '谱面不存在' }, { status: 404 });
    }
    console.error('[chart-page]', error);
    return Response.json({ error: '渲染失败' }, { status: 500 });
  }
}
