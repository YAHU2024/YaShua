import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import fs from "fs";
import path from "path";

// 自定义插件：构建完成后将 cloudfunctions/ 复制到产物目录
// 使微信开发者工具能够识别并上传部署云函数
function copyCloudFunctions() {
  let outDir = "";
  return {
    name: "copy-cloudfunctions",
    apply: "build",
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const sourceDir = path.resolve("cloudfunctions");
      if (!fs.existsSync(sourceDir)) {
        console.log("[copy-cloudfunctions] source dir not found, skip");
        return;
      }

      const targetDir = path.join(outDir, "cloudfunctions");

      // 如果目标已是 junction/符号链接，说明已手动配置链接，跳过复制
      if (fs.existsSync(targetDir)) {
        try {
          const stat = fs.lstatSync(targetDir);
          if (stat.isSymbolicLink() || (stat.isDirectory() && stat.ino === fs.statSync(sourceDir).ino)) {
            console.log("[copy-cloudfunctions] target is junction/symlink to source, skip copy");
            return;
          }
        } catch (_) { /* fall through to normal copy */ }
      }

      // 清理旧的云函数目录，避免残留
      // Windows 下若目录被占用（如开发者工具正在预览），rmSync 会报 EBUSY，
      // 因此加入重试，失败则使用 force 覆盖。
      if (fs.existsSync(targetDir)) {
        let removed = false;
        for (let i = 0; i < 3; i++) {
          try {
            fs.rmSync(targetDir, { recursive: true, force: true });
            removed = true;
            break;
          } catch (e: any) {
            if (e.code === "EBUSY") {
              console.log(
                `[copy-cloudfunctions] target dir busy, retry ${i + 1}/3...`
              );
              // 等待 500ms 后重试
              const start = Date.now();
              while (Date.now() - start < 500) {}
            } else {
              throw e;
            }
          }
        }
        if (!removed) {
          console.log(
            `[copy-cloudfunctions] target dir still busy, will overwrite in place`
          );
        }
      }

      fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
      console.log(`[copy-cloudfunctions] copied to ${targetDir}`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), copyCloudFunctions()],
});
