class YoutubeMusicCli < Formula
  desc "Terminal YouTube Music player"
  homepage "https://github.com/involvex/youtube-music-cli"
  url "https://registry.npmjs.org/@involvex/youtube-music-cli/-/youtube-music-cli-0.2.3.tgz"
  sha256 "96788f9659196ac0baf33da2fcdf1c66d86f26c2bafad8bcae7dc1818fd19246"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
  end

  test do
    assert_match "youtube-music-cli", shell_output("#{bin}/youtube-music-cli --help")
  end
end
