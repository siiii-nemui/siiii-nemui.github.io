document.addEventListener("DOMContentLoaded", () => {
  const includeHtml = async (element) => {
    const file = element.getAttribute("data-include");
    if (file) {
      try {
        const response = await fetch(file);
        if (response.ok) {
          let content = await response.text();

          // パスの補正ロジック
          // data-include のパスが ../ で始まっている場合、その階層分だけコンテンツ内のパスを調整する
          const depthMatch = file.match(/\.\.\//g);
          if (depthMatch) {
            const prefix = depthMatch.join("");
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, "text/html");

            // aタグのhref属性を補正（外部リンクやアンカーを除く）
            doc.querySelectorAll("a").forEach((a) => {
              const href = a.getAttribute("href");
              if (
                href &&
                !href.startsWith("http") &&
                !href.startsWith("#") &&
                !href.startsWith("/")
              ) {
                a.setAttribute("href", prefix + href);
              }
            });

            // imgタグのsrc属性を補正
            doc.querySelectorAll("img").forEach((img) => {
              const src = img.getAttribute("src");
              if (
                src &&
                !src.startsWith("http") &&
                !src.startsWith("/") &&
                !src.startsWith("data:")
              ) {
                img.setAttribute("src", prefix + src);
              }
            });

            content = doc.body.innerHTML;
          }

          element.innerHTML = content;
        } else {
          element.innerHTML = "Page not found.";
        }
      } catch (error) {
        console.error("Error loading HTML:", error);
      }
    }
  };

  const elements = document.querySelectorAll("[data-include]");
  elements.forEach(includeHtml);
});
