using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TS3Gifbox.Entities
{
    internal static class CupHolder
    {
        /// <summary>
        /// The source path from which the files will be taken and converted.
        /// </summary>
        public static string SourcePath;

        /// <summary>
        /// The target path to which the converted files will be written
        /// </summary>
        public static string TargetPath;

        public static class Constants
        {
            /// <summary>
            /// The path to the FFMpeg executable
            /// </summary>
            public const string FFMpegExecutablePath = "ffmpeg.exe";
        }
    }
}
