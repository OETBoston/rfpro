import * as fs from "node:fs";
import * as path from "node:path";

export abstract class Utils {

  // Recursively copies the contents of one directory to another.
  static copyDirRecursive(sourceDir: string, targetDir: string): void {
    // Checks if the target directory exists. If not, creates it.
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    // Reads the list of files and directories from the source directory.
    const files = fs.readdirSync(sourceDir);

    /*  
    •	Iterates over each file and directory in the source directory.
    •	Constructs the full path for the source and target files.
    •	Gets the file or directory stats. 
    */
    for (const file of files) {
      const sourceFilePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetDir, file);
      const stats = fs.statSync(sourceFilePath);

      /*
      •	If the item is a directory, it calls copyDirRecursive recursively to copy the directory’s contents.
	    •	If the item is a file, it copies the file from the source to the target directory.
      */
      if (stats.isDirectory()) {
        Utils.copyDirRecursive(sourceFilePath, targetFilePath);
      } else {
        fs.copyFileSync(sourceFilePath, targetFilePath);
      }
    }
  }

}
