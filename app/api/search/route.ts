import { searchSongs } from '@/lib/songs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const songs = await searchSongs(query);

  return Response.json({
    query,
    count: songs.length,
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      character: song.character,
      aliases: song.aliases.map((alias) => alias.alias),
      charts: song.charts.map((chart) => ({
        id: chart.id,
        difficultyName: chart.difficultyName,
        difficultyLevel: chart.difficultyLevel,
        pageCount: chart.pageCount,
        noteCount: chart.noteCount,
        jsonFile: chart.jsonFile,
      })),
    })),
  });
}
