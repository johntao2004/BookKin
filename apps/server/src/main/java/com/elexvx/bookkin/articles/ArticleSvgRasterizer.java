package com.elexvx.bookkin.articles;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.batik.anim.dom.SVGDOMImplementation;
import org.apache.batik.bridge.ExternalResourceSecurity;
import org.apache.batik.bridge.ScriptSecurity;
import org.apache.batik.bridge.UserAgent;
import org.apache.batik.bridge.UserAgentAdapter;
import org.apache.batik.transcoder.SVGAbstractTranscoder;
import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;
import org.apache.batik.util.ParsedURL;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.DataNode;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.w3c.dom.Document;

/** Rasterizes a deliberately small, self-contained subset of SVG for captured articles. */
final class ArticleSvgRasterizer {
  private static final String SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  private static final int MAX_INPUT_BYTES = 1_048_576;
  private static final int MAX_NODES = 10_000;
  private static final int MAX_DEPTH = 128;
  private static final int MAX_ATTRIBUTE_CHARS = 65_536;
  private static final int MAX_STYLE_CHARS = 16_384;
  private static final int MAX_DIMENSION = 4_096;
  private static final double MAX_VIEWBOX_COORDINATE = 1_000_000;
  private static final long MAX_PIXELS = 20_000_000L;
  private static final int MAX_OUTPUT_BYTES = 5 * 1_048_576;

  private static final Set<String> ALLOWED_ELEMENTS = Set.of(
      "g", "defs", "marker", "clippath", "path", "rect", "circle", "ellipse",
      "line", "polyline", "polygon", "text", "tspan");
  private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z_][A-Za-z0-9_.:-]{0,127}");
  private static final Pattern LOCAL_URL = Pattern.compile(
      "(?i)url\\(\\s*(['\"]?)#([A-Za-z_][A-Za-z0-9_.:-]{0,127})\\1\\s*\\)");
  private static final Pattern NUMBER = Pattern.compile(
      "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?(px)?", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATH_DATA = Pattern.compile("[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\\-\\s]*");
  private static final Pattern NUMERIC_DATA = Pattern.compile("[0-9eE.,+\\-\\s]*");
  private static final Pattern NUMBER_TOKEN = Pattern.compile("[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?");
  private static final Pattern TRANSFORM = Pattern.compile(
      "(?i)\\s*(?:(?:matrix|translate|scale|rotate|skewx|skewy)\\s*\\(\\s*[-+0-9.e,\\s]+\\)\\s*)+");
  private static final Pattern COLOR = Pattern.compile(
      "(?i)(?:none|currentcolor|transparent|[a-z]+|#[0-9a-f]{3,8}|rgba?\\(\\s*[-+0-9.%\\s,]+\\)|hsla?\\(\\s*[-+0-9.%\\s,]+\\))");

  private static final Map<String, String> CANONICAL_ATTRIBUTES = Map.ofEntries(
      Map.entry("viewbox", "viewBox"),
      Map.entry("preserveaspectratio", "preserveAspectRatio"),
      Map.entry("markerwidth", "markerWidth"),
      Map.entry("markerheight", "markerHeight"),
      Map.entry("markerunits", "markerUnits"),
      Map.entry("refx", "refX"),
      Map.entry("refy", "refY"),
      Map.entry("clippathunits", "clipPathUnits"));

  private static final Set<String> SAFE_PRESENTATION_ATTRIBUTES = Set.of(
      "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
      "viewbox", "preserveaspectratio", "d", "points", "fill", "stroke", "stroke-width",
      "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
      "fill-rule", "clip-rule", "fill-opacity", "stroke-opacity", "opacity", "transform", "text-anchor",
      "dominant-baseline", "alignment-baseline", "font-family", "font-size", "font-weight", "font-style",
      "letter-spacing", "marker-start", "marker-mid", "marker-end", "clip-path", "markerwidth", "markerheight",
      "markerunits", "refx", "refy", "orient", "clippathunits", "overflow", "vector-effect",
      "shape-rendering", "text-rendering", "color", "display", "visibility", "paint-order");

  private ArticleSvgRasterizer() {}

  static byte[] rasterize(Element svg) throws IOException {
    if (svg == null || !"svg".equalsIgnoreCase(svg.normalName())) {
      throw new IOException("Expected an SVG element");
    }

    InputBudget budget = new InputBudget();
    measureTree(svg, budget, 0);
    if (budget.bytes > MAX_INPUT_BYTES) {
      throw new IOException("SVG input exceeds 1 MiB");
    }

    Dimensions dimensions = dimensionsOf(svg);
    int pixelWidth = (int) Math.ceil(dimensions.width);
    int pixelHeight = (int) Math.ceil(dimensions.height);
    if (pixelWidth < 1 || pixelHeight < 1 || pixelWidth > MAX_DIMENSION || pixelHeight > MAX_DIMENSION) {
      throw new IOException("SVG dimensions must be between 1 and 4096 pixels per side");
    }
    if ((long) pixelWidth * pixelHeight > MAX_PIXELS) {
      throw new IOException("SVG exceeds the 20 million pixel limit");
    }

    Document safeDocument = SVGDOMImplementation.getDOMImplementation()
        .createDocument(SVG_NAMESPACE, "svg", null);
    org.w3c.dom.Element safeRoot = safeDocument.getDocumentElement();
    copyAttributes(svg, safeRoot);
    safeRoot.setAttribute("width", Double.toString(dimensions.width));
    safeRoot.setAttribute("height", Double.toString(dimensions.height));
    if (safeRoot.getAttribute("viewBox").isEmpty()) {
      safeRoot.setAttribute("viewBox", "0 0 " + dimensions.width + " " + dimensions.height);
    }
    copyChildren(svg, safeRoot, safeDocument);

    LimitedOutputStream output = new LimitedOutputStream(MAX_OUTPUT_BYTES);
    SafePngTranscoder transcoder = new SafePngTranscoder();
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_EXECUTE_ONLOAD, Boolean.FALSE);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_ALLOW_EXTERNAL_RESOURCES, Boolean.FALSE);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_ALLOWED_SCRIPT_TYPES, "");
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_DEFAULT_FONT_FAMILY, "SansSerif");
    transcoder.addTranscodingHint(PNGTranscoder.KEY_BACKGROUND_COLOR, Color.WHITE);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_WIDTH, (float) dimensions.width);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_HEIGHT, (float) dimensions.height);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_MAX_WIDTH, (float) MAX_DIMENSION);
    transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_MAX_HEIGHT, (float) MAX_DIMENSION);
    try {
      transcoder.transcode(new TranscoderInput(safeDocument), new TranscoderOutput(output));
    } catch (TranscoderException | RuntimeException exception) {
      IOException limitException = output.limitException;
      if (limitException != null) {
        throw limitException;
      }
      throw new IOException("SVG could not be rasterized safely", exception);
    }

    byte[] png = output.toByteArray();
    if (png.length == 0) {
      throw new IOException("SVG rasterizer produced an empty PNG");
    }
    return png;
  }

  private static void measureTree(Node node, InputBudget budget, int depth) throws IOException {
    if (depth > MAX_DEPTH) {
      throw new IOException("SVG nesting exceeds 128 levels");
    }
    budget.addNode();
    if (node instanceof Element element) {
      budget.addText(element.normalName());
      for (Attribute attribute : element.attributes()) {
        budget.addText(attribute.getKey());
        budget.addText(attribute.getValue());
        budget.addBytes(4);
      }
    } else if (node instanceof TextNode textNode) {
      budget.addText(textNode.getWholeText());
    } else if (node instanceof DataNode dataNode) {
      budget.addText(dataNode.getWholeData());
    }
    budget.addBytes(3);
    for (Node child : node.childNodes()) {
      measureTree(child, budget, depth + 1);
    }
  }

  private static Dimensions dimensionsOf(Element svg) throws IOException {
    double[] viewBox = parseViewBox(attributeIgnoreCase(svg, "viewBox"));
    String rawWidth = attributeIgnoreCase(svg, "width");
    String rawHeight = attributeIgnoreCase(svg, "height");
    double width = rawWidth == null || rawWidth.isBlank()
        ? viewBox == null ? Double.NaN : viewBox[2]
        : parseLength(rawWidth);
    double height = rawHeight == null || rawHeight.isBlank()
        ? viewBox == null ? Double.NaN : viewBox[3]
        : parseLength(rawHeight);
    if (!Double.isFinite(width) || !Double.isFinite(height) || width <= 0 || height <= 0) {
      throw new IOException("SVG needs positive numeric width and height or a valid viewBox");
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new IOException("SVG dimensions must be between 1 and 4096 pixels per side");
    }
    return new Dimensions(width, height);
  }

  private static double[] parseViewBox(String value) throws IOException {
    if (value == null || value.isBlank()) {
      return null;
    }
    String[] parts = value.trim().split("[\\s,]+");
    if (parts.length != 4) {
      throw new IOException("Invalid SVG viewBox");
    }
    double[] box = new double[4];
    for (int index = 0; index < parts.length; index++) {
      box[index] = parsePlainNumber(parts[index]);
      if (Math.abs(box[index]) > MAX_VIEWBOX_COORDINATE) {
        throw new IOException("SVG viewBox coordinates are out of range");
      }
    }
    if (box[2] < 0.001 || box[3] < 0.001) {
      throw new IOException("SVG viewBox must have positive width and height");
    }
    return box;
  }

  private static double parseLength(String value) throws IOException {
    String trimmed = value.trim();
    Matcher matcher = NUMBER.matcher(trimmed);
    if (!matcher.matches()) {
      throw new IOException("SVG dimensions must use numeric pixels");
    }
    return finiteNumber(trimmed.replaceFirst("(?i)px$", ""));
  }

  private static double parsePlainNumber(String value) throws IOException {
    if (!NUMBER.matcher(value).matches() || value.toLowerCase(Locale.ROOT).endsWith("px")) {
      throw new IOException("Invalid numeric SVG coordinate");
    }
    return finiteNumber(value);
  }

  private static double finiteNumber(String value) throws IOException {
    try {
      double parsed = Double.parseDouble(value);
      if (!Double.isFinite(parsed)) {
        throw new IOException("SVG numeric values must be finite");
      }
      return parsed;
    } catch (NumberFormatException exception) {
      throw new IOException("Invalid SVG numeric value", exception);
    }
  }

  private static String attributeIgnoreCase(Element element, String name) {
    for (Attribute attribute : element.attributes()) {
      if (name.equalsIgnoreCase(attribute.getKey())) {
        return attribute.getValue();
      }
    }
    return null;
  }

  private static void copyChildren(Element source, org.w3c.dom.Element target, Document document) {
    for (Node child : source.childNodes()) {
      if (child instanceof Element element) {
        String localName = element.normalName().toLowerCase(Locale.ROOT);
        if (!ALLOWED_ELEMENTS.contains(localName) || !hasRequiredGeometry(element, localName)) {
          continue;
        }
        String canonicalName = "clippath".equals(localName) ? "clipPath" : localName;
        org.w3c.dom.Element copy = document.createElementNS(SVG_NAMESPACE, canonicalName);
        copyAttributes(element, copy);
        target.appendChild(copy);
        copyChildren(element, copy, document);
      } else if (child instanceof TextNode textNode) {
        if ("text".equalsIgnoreCase(source.normalName()) || "tspan".equalsIgnoreCase(source.normalName())) {
          target.appendChild(document.createTextNode(textNode.getWholeText()));
        }
      }
    }
  }

  private static boolean hasRequiredGeometry(Element element, String localName) {
    return switch (localName) {
      case "rect" -> hasSafeGeometryAttribute(element, "width") && hasSafeGeometryAttribute(element, "height");
      case "circle" -> hasSafeGeometryAttribute(element, "r");
      case "ellipse" -> hasSafeGeometryAttribute(element, "rx") && hasSafeGeometryAttribute(element, "ry");
      case "path" -> hasSafeGeometryAttribute(element, "d");
      case "polyline", "polygon" -> hasSafeGeometryAttribute(element, "points");
      default -> true;
    };
  }

  private static boolean hasSafeGeometryAttribute(Element element, String name) {
    String value = attributeIgnoreCase(element, name);
    return value != null && sanitizePresentationValue(name, value) != null;
  }

  private static void copyAttributes(Element source, org.w3c.dom.Element target) {
    for (Attribute attribute : source.attributes()) {
      String name = attribute.getKey().toLowerCase(Locale.ROOT);
      if ("xmlns".equals(name) || "version".equals(name) || "class".equals(name)) {
        continue;
      }
      String safeValue;
      if ("id".equals(name)) {
        safeValue = SAFE_ID.matcher(attribute.getValue()).matches() ? attribute.getValue() : null;
      } else if ("style".equals(name)) {
        safeValue = sanitizeStyle(attribute.getValue());
      } else if (SAFE_PRESENTATION_ATTRIBUTES.contains(name)) {
        safeValue = sanitizePresentationValue(name, attribute.getValue());
      } else {
        continue;
      }
      if (safeValue == null || safeValue.isEmpty()) {
        continue;
      }
      target.setAttribute(CANONICAL_ATTRIBUTES.getOrDefault(name, name), safeValue);
    }
  }

  private static String sanitizeStyle(String style) {
    if (style.length() > MAX_STYLE_CHARS || containsControlCharacter(style)) {
      return "";
    }
    List<String> safeDeclarations = new ArrayList<>();
    for (String declaration : style.split(";")) {
      int separator = declaration.indexOf(':');
      if (separator <= 0) {
        continue;
      }
      String property = declaration.substring(0, separator).trim().toLowerCase(Locale.ROOT);
      String value = declaration.substring(separator + 1).trim();
      if (!isSafeStyleProperty(property)) {
        continue;
      }
      String safeValue = sanitizePresentationValue(property, value);
      if (safeValue != null && !safeValue.isEmpty()) {
        safeDeclarations.add(property + ":" + safeValue);
      }
    }
    return String.join(";", safeDeclarations);
  }

  private static boolean isSafeStyleProperty(String property) {
    return SAFE_PRESENTATION_ATTRIBUTES.contains(property)
        && !Set.of("x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
            "viewbox", "preserveaspectratio", "d", "points", "id", "class", "markerwidth", "markerheight",
            "markerunits", "refx", "refy", "orient", "clippathunits").contains(property);
  }

  private static String sanitizePresentationValue(String name, String value) {
    String normalized = value.trim();
    if (normalized.isEmpty() || normalized.length() > MAX_ATTRIBUTE_CHARS || containsControlCharacter(normalized)
        || normalized.indexOf('\\') >= 0 || normalized.indexOf('{') >= 0 || normalized.indexOf('}') >= 0
        || normalized.indexOf('<') >= 0 || normalized.indexOf('>') >= 0) {
      return null;
    }
    if ("font-family".equals(name)) {
      return "SansSerif";
    }
    if ("viewbox".equals(name)) {
      try {
        double[] box = parseViewBox(normalized);
        return box == null ? null : numberList(box);
      } catch (IOException exception) {
        return null;
      }
    }
    if ("preserveaspectratio".equals(name)) {
      return normalized.matches("(?i)(?:none|x(?:min|mid|max)y(?:min|mid|max)(?:meet|slice))(?:\\s+(?:meet|slice))?")
          ? normalized : null;
    }
    if ("d".equals(name)) {
      return normalized.length() <= MAX_ATTRIBUTE_CHARS && PATH_DATA.matcher(normalized).matches()
          && numericTokensWithinBounds(normalized) ? normalized : null;
    }
    if ("points".equals(name)) {
      return normalized.length() <= MAX_ATTRIBUTE_CHARS && NUMERIC_DATA.matcher(normalized).matches()
          && numericTokensWithinBounds(normalized) ? normalized : null;
    }
    if ("transform".equals(name)) {
      return TRANSFORM.matcher(normalized).matches() && numericTokensWithinBounds(normalized) ? normalized : null;
    }
    if ("fill".equals(name) || "stroke".equals(name) || "color".equals(name)) {
      return isSafeColor(normalized) ? normalized : null;
    }
    if ("clip-path".equals(name) || name.startsWith("marker-")) {
      return "none".equalsIgnoreCase(normalized) || isLocalReference(normalized) ? normalized : null;
    }
    if ("stroke-dasharray".equals(name)) {
      return "none".equalsIgnoreCase(normalized) || isNumberList(normalized, true) ? normalized : null;
    }
    if (Set.of("stroke-width", "stroke-dashoffset", "stroke-miterlimit", "font-size", "letter-spacing",
        "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
        "markerwidth", "markerheight", "refx", "refy").contains(name)) {
      return isNumberList(normalized, true) && normalized.indexOf(' ') < 0 && normalized.indexOf(',') < 0
          ? normalized : null;
    }
    if ("opacity".equals(name) || "fill-opacity".equals(name) || "stroke-opacity".equals(name)) {
      try {
        double opacity = finiteNumber(normalized);
        return opacity >= 0 && opacity <= 1 ? normalized : null;
      } catch (IOException exception) {
        return null;
      }
    }
    if ("font-weight".equals(name)) {
      return normalized.matches("(?i)(?:normal|bold|bolder|lighter|[1-9]00)") ? normalized : null;
    }
    if ("font-style".equals(name)) {
      return normalized.matches("(?i)(?:normal|italic|oblique)") ? normalized : null;
    }
    if ("text-anchor".equals(name) || "text-align".equals(name)) {
      return normalized.matches("(?i)(?:start|middle|end|left|center|right)") ? normalized : null;
    }
    if ("stroke-linecap".equals(name)) {
      return normalized.matches("(?i)(?:butt|round|square)") ? normalized : null;
    }
    if ("stroke-linejoin".equals(name)) {
      return normalized.matches("(?i)(?:miter|round|bevel|miter-clip)") ? normalized : null;
    }
    if ("fill-rule".equals(name) || "clip-rule".equals(name)) {
      return normalized.matches("(?i)(?:nonzero|evenodd)") ? normalized : null;
    }
    if ("dominant-baseline".equals(name) || "alignment-baseline".equals(name)) {
      return normalized.matches("(?i)(?:auto|text-bottom|alphabetic|ideographic|middle|central|mathematical|hanging|text-top)")
          ? normalized : null;
    }
    if ("orient".equals(name)) {
      return "auto".equalsIgnoreCase(normalized) || "auto-start-reverse".equalsIgnoreCase(normalized)
          || (normalized.toLowerCase(Locale.ROOT).endsWith("deg")
              ? isNumberList(normalized.substring(0, normalized.length() - 3), false)
              : isNumberList(normalized, false)) ? normalized : null;
    }
    if ("markerunits".equals(name) || "clippathunits".equals(name)) {
      return normalized.matches("(?i)(?:userspaceonuse|objectboundingbox|strokewidth)") ? normalized : null;
    }
    if ("overflow".equals(name)) {
      return normalized.matches("(?i)(?:visible|hidden|scroll|auto)") ? normalized : null;
    }
    if ("vector-effect".equals(name)) {
      return "none".equalsIgnoreCase(normalized) || "non-scaling-stroke".equalsIgnoreCase(normalized) ? normalized : null;
    }
    if ("shape-rendering".equals(name) || "text-rendering".equals(name)) {
      return normalized.matches("(?i)(?:auto|optimizeSpeed|crispEdges|geometricPrecision|optimizeLegibility)")
          ? normalized : null;
    }
    if ("display".equals(name)) {
      return normalized.matches("(?i)(?:inline|none)") ? normalized : null;
    }
    if ("visibility".equals(name)) {
      return normalized.matches("(?i)(?:visible|hidden|collapse)") ? normalized : null;
    }
    if ("paint-order".equals(name)) {
      return normalized.matches("(?i)(?:normal|fill|stroke|markers)(?:\\s+(?:fill|stroke|markers))*") ? normalized : null;
    }
    return null;
  }

  private static boolean isSafeColor(String value) {
    return COLOR.matcher(value).matches() || isLocalReference(value);
  }

  private static boolean isLocalReference(String value) {
    return LOCAL_URL.matcher(value).matches();
  }

  private static boolean isNumberList(String value, boolean allowPixels) {
    String[] parts = value.trim().split("[\\s,]+");
    if (parts.length == 0 || parts.length > 4_096) {
      return false;
    }
    for (String part : parts) {
      Matcher matcher = NUMBER.matcher(part);
      if (!matcher.matches() || (!allowPixels && matcher.group(1) != null)) {
        return false;
      }
      try {
        double valueNumber = Double.parseDouble(part.replaceFirst("(?i)px$", ""));
        if (!Double.isFinite(valueNumber) || Math.abs(valueNumber) > MAX_VIEWBOX_COORDINATE) {
          return false;
        }
      } catch (NumberFormatException exception) {
        return false;
      }
    }
    return true;
  }

  private static boolean numericTokensWithinBounds(String value) {
    Matcher matcher = NUMBER_TOKEN.matcher(value);
    while (matcher.find()) {
      try {
        double number = Double.parseDouble(matcher.group());
        if (!Double.isFinite(number) || Math.abs(number) > MAX_VIEWBOX_COORDINATE) {
          return false;
        }
      } catch (NumberFormatException exception) {
        return false;
      }
    }
    return true;
  }

  private static String numberList(double[] values) {
    StringBuilder result = new StringBuilder();
    for (double value : values) {
      if (!result.isEmpty()) {
        result.append(' ');
      }
      result.append(Double.toString(value));
    }
    return result.toString();
  }

  private static boolean containsControlCharacter(String value) {
    for (int index = 0; index < value.length(); index++) {
      char character = value.charAt(index);
      if (Character.isISOControl(character) && !Character.isWhitespace(character)) {
        return true;
      }
    }
    return false;
  }

  private record Dimensions(double width, double height) {}

  private static final class InputBudget {
    private int nodes;
    private long bytes;

    private void addNode() throws IOException {
      nodes++;
      if (nodes > MAX_NODES) {
        throw new IOException("SVG contains more than 10000 nodes");
      }
    }

    private void addText(String value) throws IOException {
      if (value == null) {
        return;
      }
      if (value.length() > MAX_INPUT_BYTES) {
        throw new IOException("SVG input exceeds 1 MiB");
      }
      addBytes(value.getBytes(StandardCharsets.UTF_8).length);
    }

    private void addBytes(long amount) throws IOException {
      bytes += amount;
      if (bytes > MAX_INPUT_BYTES) {
        throw new IOException("SVG input exceeds 1 MiB");
      }
    }
  }

  private static final class LimitedOutputStream extends OutputStream {
    private final ByteArrayOutputStream delegate = new ByteArrayOutputStream();
    private final int maximumBytes;
    private IOException limitException;

    private LimitedOutputStream(int maximumBytes) {
      this.maximumBytes = maximumBytes;
    }

    @Override
    public void write(int value) throws IOException {
      ensureCapacity(1);
      delegate.write(value);
    }

    @Override
    public void write(byte[] bytes, int offset, int length) throws IOException {
      ensureCapacity(length);
      delegate.write(bytes, offset, length);
    }

    private void ensureCapacity(int length) throws IOException {
      if ((long) delegate.size() + length > maximumBytes) {
        limitException = new IOException("Rasterized PNG exceeds 5 MiB");
        throw limitException;
      }
    }

    private byte[] toByteArray() {
      return delegate.toByteArray();
    }
  }

  private static final class SafePngTranscoder extends PNGTranscoder {
    @Override
    protected UserAgent createUserAgent() {
      return new UserAgentAdapter() {
        @Override
        public String getDefaultFontFamily() {
          return "SansSerif";
        }

        @Override
        public ScriptSecurity getScriptSecurity(String scriptType, ParsedURL scriptUrl, ParsedURL documentUrl) {
          return () -> { throw new SecurityException("SVG scripts are disabled"); };
        }

        @Override
        public ExternalResourceSecurity getExternalResourceSecurity(ParsedURL resourceUrl, ParsedURL documentUrl) {
          return () -> { throw new SecurityException("External SVG resources are disabled"); };
        }

        @Override
        public void checkLoadScript(String scriptType, ParsedURL scriptUrl, ParsedURL documentUrl) {
          throw new SecurityException("SVG scripts are disabled");
        }

        @Override
        public void checkLoadExternalResource(ParsedURL resourceUrl, ParsedURL documentUrl) {
          throw new SecurityException("External SVG resources are disabled");
        }
      };
    }
  }
}
