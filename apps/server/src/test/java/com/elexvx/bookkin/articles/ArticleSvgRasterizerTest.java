package com.elexvx.bookkin.articles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.junit.jupiter.api.Test;

class ArticleSvgRasterizerTest {
  @Test
  void rasterizesTextShapesAndLocalMarkerReferencesIntoPng() throws Exception {
    Element svg = svg("""
        <svg xmlns="http://www.w3.org/2000/svg" width="180" height="100" viewBox="0 0 180 100"
             style="font-family:'trebuchet ms',verdana,sans-serif;font-size:16px;color:#222;">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
                    markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#245c3a" />
            </marker>
            <clipPath id="clip"><rect x="8" y="8" width="164" height="84" /></clipPath>
          </defs>
          <g clip-path="url(#clip)">
            <rect x="10" y="10" width="40" height="24" fill="#e85d4a" />
            <path d="M 55 22 L 90 22" fill="none" stroke="#245c3a" stroke-width="2"
                  marker-end="url(#arrow)" />
            <text x="112" y="28" text-anchor="middle" style="font-size:16px;fill:#222;">
              <tspan>中文流程</tspan>
            </text>
          </g>
        </svg>
        """);

    byte[] png = ArticleSvgRasterizer.rasterize(svg);
    BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));

    assertNotNull(image);
    assertEquals((byte) 0x89, png[0]);
    assertEquals((byte) 'P', png[1]);
    assertEquals(180, image.getWidth());
    assertEquals(100, image.getHeight());
    assertEquals(0xffffffff, image.getRGB(179, 99), "transparent SVG space should render on white");
    assertTrue(countPixels(image, 10, 10, 50, 34, color -> red(color) > 150) > 100,
        "the filled rectangle should remain visible");
    assertTrue(countPixels(image, 80, 10, 145, 36, color -> alpha(color) > 0 && red(color) < 120) > 8,
        "the text glyphs should remain visible");
  }

  @Test
  void discardsScriptsForeignObjectsAndExternalResourcesWithoutFetchingThem() throws Exception {
    AtomicInteger requests = new AtomicInteger();
    Path localImage = Files.createTempFile("article-svg-secret", ".png");
    BufferedImage secret = new BufferedImage(8, 8, BufferedImage.TYPE_INT_ARGB);
    for (int y = 0; y < secret.getHeight(); y++) {
      for (int x = 0; x < secret.getWidth(); x++) {
        secret.setRGB(x, y, 0xffff00ff);
      }
    }
    ImageIO.write(secret, "png", localImage.toFile());
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/resource.svg", exchange -> {
      requests.incrementAndGet();
      exchange.sendResponseHeaders(200, 0);
      exchange.close();
    });
    server.start();
    try {
      String remoteUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/resource.svg";
      String localUrl = localImage.toUri().toASCIIString();
      Element svg = svg("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60' "
          + "onload=\"fetch('" + remoteUrl + "')\">"
          + "<script>fetch('" + remoteUrl + "')</script>"
          + "<foreignObject width='40' height='20'><img src='" + remoteUrl + "'></foreignObject>"
          + "<image href='" + remoteUrl + "' width='20' height='20'/>"
          + "<image href='" + localUrl + "' x='45' y='2' width='16' height='16'/>"
          + "<rect x='2' y='2' width='30' height='30' fill='#245c3a' "
          + "style='fill:url(" + remoteUrl + "#paint);'/></svg>");

      byte[] png = ArticleSvgRasterizer.rasterize(svg);
      BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
      assertNotNull(image);
      assertEquals(0, requests.get());
      assertEquals(0, countPixels(image, 0, 0, image.getWidth(), image.getHeight(), color ->
          red(color) > 200 && ((color >>> 8) & 0xff) < 100 && (color & 0xff) > 200),
          "file-backed SVG images must not be read or rendered");
    } finally {
      server.stop(0);
      Files.deleteIfExists(localImage);
    }
  }

  @Test
  void rejectsOversizedDimensionsAndInputBytes() {
    Element tooWide = svg("<svg width='4097' height='1' viewBox='0 0 4097 1'><rect width='1' height='1'/></svg>");
    assertThrows(IOException.class, () -> ArticleSvgRasterizer.rasterize(tooWide));

    String largeText = "x".repeat(1_048_600);
    Element tooLarge = svg("<svg width='1' height='1'><text>" + largeText + "</text></svg>");
    assertThrows(IOException.class, () -> ArticleSvgRasterizer.rasterize(tooLarge));
  }

  @Test
  void rejectsSvgWithTooManyNodes() {
    StringBuilder markup = new StringBuilder("<svg width='10' height='10'>");
    for (int index = 0; index < 10_001; index++) {
      markup.append("<rect width='1' height='1'/>");
    }
    markup.append("</svg>");
    Element tooManyNodes = svg(markup.toString());

    assertThrows(IOException.class, () -> ArticleSvgRasterizer.rasterize(tooManyNodes));
  }

  private static Element svg(String markup) {
    Element element = Jsoup.parseBodyFragment(markup).selectFirst("svg");
    assertNotNull(element);
    return element;
  }

  private static long countPixels(BufferedImage image, int left, int top, int right, int bottom,
                                  java.util.function.IntPredicate predicate) {
    long count = 0;
    for (int y = top; y < bottom; y++) {
      for (int x = left; x < right; x++) {
        if (predicate.test(image.getRGB(x, y))) {
          count++;
        }
      }
    }
    return count;
  }

  private static int red(int argb) {
    return (argb >>> 16) & 0xff;
  }

  private static int alpha(int argb) {
    return (argb >>> 24) & 0xff;
  }
}
