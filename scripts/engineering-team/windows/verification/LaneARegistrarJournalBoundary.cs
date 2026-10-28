// #3302 WO-001B: NON-RELEASE native Windows registrar journal boundary.
// No signer, key, reviewer, catalogue, service installation, or release authority.
// Only an ephemeral diagnostic may invoke this CLI. Production must be hosted by
// a separately credentialed registrar with independent ACL/token/STOP acceptance.
using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

internal static class LaneARegistrarJournalBoundary
{
    const string Header = "PP-LANE-A-PREPROVISIONED-JOURNAL-V1\n";
    const int MaxBytes = 8 * 1024 * 1024;
    const int MaxFrame = 512;
    static readonly Regex Hex64 = new Regex("^[a-f0-9]{64}$", RegexOptions.CultureInvariant);
    static readonly Regex Hex32 = new Regex("^[a-f0-9]{32}$", RegexOptions.CultureInvariant);
    static readonly Regex Record = new Regex(
        "^\\{\\\"v\\\":1,\\\"op\\\":\\\"(ISSUE|SPEND)\\\",\\\"nonce\\\":\\\"([a-f0-9]{64})\\\",\\\"scopeDigest\\\":\\\"([a-f0-9]{64})\\\",\\\"requestId\\\":\\\"([a-f0-9]{32})\\\"\\}$",
        RegexOptions.CultureInvariant);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint length, uint flags);

    static byte[] Hash(byte[] bytes) { using (var sha=SHA256.Create()) return sha.ComputeHash(bytes); }
    static byte[] Join(byte[] a, byte[] b) {
        var result=new byte[a.Length+b.Length]; Buffer.BlockCopy(a,0,result,0,a.Length);
        Buffer.BlockCopy(b,0,result,a.Length,b.Length); return result;
    }
    static bool Same(byte[] a, byte[] b) {
        if(a.Length!=b.Length) return false;
        int diff=0; for(int i=0;i<a.Length;i++) diff|=a[i]^b[i]; return diff==0;
    }
    static void Require(bool ok,string code) { if(!ok) throw new InvalidDataException(code); }
    static string Canonical(string p) {
        Require(!string.IsNullOrEmpty(p) && Path.IsPathRooted(p) && p.Length<=512,"PATH_INVALID");
        var full=Path.GetFullPath(p);
        var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        Require(full.StartsWith(temp+"pp-f00-native-journal-",StringComparison.OrdinalIgnoreCase),
            "EPHEMERAL_ROOT_REQUIRED");
        string root=Path.GetPathRoot(full), current=root;
        foreach(var component in full.Substring(root.Length).Split(Path.DirectorySeparatorChar)) {
            if(component.Length==0) continue;
            current=Path.Combine(current,component);
            var attributes=File.GetAttributes(current);
            Require((attributes & FileAttributes.ReparsePoint)==0,"REPARSE_POINT_DENIED");
        }
        Require((File.GetAttributes(full)&FileAttributes.Directory)==0,"REGULAR_FILE_REQUIRED");
        Require(Path.GetFileName(full)=="registrar-journal.bin","FIXED_BASENAME_REQUIRED");
        return full;
    }
    static void VerifyHandle(FileStream fs,string expected) {
        var b=new StringBuilder(1024);
        uint n=GetFinalPathNameByHandle(fs.SafeFileHandle,b,(uint)b.Capacity,0);
        Require(n>0 && n<b.Capacity,"HANDLE_FINAL_PATH_UNVERIFIABLE");
        string actual=b.ToString();
        string target=@"\\?\"+expected;
        Require(string.Equals(actual,target,StringComparison.OrdinalIgnoreCase),"HANDLE_PATH_SWAP_DENIED");
        Require(string.Equals(Canonical(expected),expected,StringComparison.OrdinalIgnoreCase),"PATH_SWAP_DENIED");
    }
    static string Process(FileStream fs,string operation,string scope,string request,string suppliedNonce) {
        Require(fs.Length>=Encoding.UTF8.GetByteCount(Header) && fs.Length<=MaxBytes,"JOURNAL_SIZE_INVALID");
        byte[] data=new byte[(int)fs.Length]; fs.Position=0;
        int received=0; while(received<data.Length) {
            int n=fs.Read(data,received,data.Length-received);
            Require(n>0,"SHORT_READ"); received+=n;
        }
        var prefix=Encoding.UTF8.GetBytes(Header);
        Require(Same(Sub(data,0,prefix.Length),prefix),"HEADER_INVALID");
        byte[] previous=Hash(prefix);
        var issued=new Dictionary<string,string>(StringComparer.Ordinal);
        var spent=new HashSet<string>(StringComparer.Ordinal);
        var requests=new HashSet<string>(StringComparer.Ordinal);
        int offset=prefix.Length;
        while(offset<data.Length) {
            Require(data.Length-offset>=4,"TORN_TAIL");
            long len=((long)data[offset]<<24)|((long)data[offset+1]<<16)|
                     ((long)data[offset+2]<<8)|data[offset+3]; offset+=4;
            Require(len>0 && len<=MaxFrame && data.Length-offset>=len+32,"TORN_FRAME");
            byte[] payload=Sub(data,offset,(int)len); offset+=(int)len;
            byte[] checksum=Sub(data,offset,32); offset+=32;
            previous=Hash(Join(previous,payload));
            Require(Same(checksum,previous),"CHAIN_INVALID");
            string text=new UTF8Encoding(false,true).GetString(payload);
            var match=Record.Match(text); Require(match.Success,"RECORD_INVALID");
            string op=match.Groups[1].Value, nonce=match.Groups[2].Value;
            string sc=match.Groups[3].Value, id=match.Groups[4].Value;
            Require(requests.Add(id),"DUPLICATE_REQUEST");
            if(op=="ISSUE") Require(!issued.ContainsKey(nonce),"DUPLICATE_ISSUE");
            if(op=="ISSUE") issued.Add(nonce,sc);
            else {
                Require(issued.ContainsKey(nonce) && issued[nonce]==sc &&
                    spent.Add(nonce),"INVALID_SPEND");
            }
        }
        Require(!requests.Contains(request),"REQUEST_REPLAY_DENIED");
        string selected=suppliedNonce;
        if(operation=="ISSUE") {
            var random=new byte[32]; using(var rng=RandomNumberGenerator.Create()) rng.GetBytes(random);
            selected=BitConverter.ToString(random).Replace("-","").ToLowerInvariant();
            Require(!issued.ContainsKey(selected),"NONCE_COLLISION");
        } else {
            Require(issued.ContainsKey(selected) && issued[selected]==scope &&
                !spent.Contains(selected),"NONCE_SPENT_OR_SCOPE_INVALID");
        }
        string record="{\"v\":1,\"op\":\""+operation+"\",\"nonce\":\""+selected+
            "\",\"scopeDigest\":\""+scope+"\",\"requestId\":\""+request+"\"}";
        byte[] bytes=Encoding.UTF8.GetBytes(record);
        Require(bytes.Length<=MaxFrame,"RECORD_OVERSIZED");
        byte[] checksumNext=Hash(Join(previous,bytes));
        byte[] frame=new byte[4+bytes.Length+32];
        frame[0]=(byte)(bytes.Length>>24); frame[1]=(byte)(bytes.Length>>16);
        frame[2]=(byte)(bytes.Length>>8); frame[3]=(byte)bytes.Length;
        Buffer.BlockCopy(bytes,0,frame,4,bytes.Length);
        Buffer.BlockCopy(checksumNext,0,frame,4+bytes.Length,32);
        Require(fs.Length+frame.Length<=MaxBytes,"JOURNAL_FULL");
        fs.Position=fs.Length;
        fs.Write(frame,0,frame.Length);
        fs.Flush(true); // Native regular-file FlushFileBuffers, NOT directory fsync.
        return selected;
    }
    static byte[] Sub(byte[] bytes,int offset,int length) {
        Require(offset>=0 && length>=0 && offset<=bytes.Length-length,"FRAME_BOUNDS");
        var part=new byte[length]; Buffer.BlockCopy(bytes,offset,part,0,length); return part;
    }
    static int Main(string[] args) {
        // Never allow arbitrary invocation on an owner/production registrar.
        if(Environment.OSVersion.Platform!=PlatformID.Win32NT ||
           Environment.GetEnvironmentVariable("PLOTPICKLE_LANE_A_EPHEMERAL_CI")!="1")
            return Block("NON_RELEASE_WINDOWS_DIAGNOSTIC_ONLY");
        if(args.Length<5 || args.Length>6 || args[0]!="--operate")
            return Block("ARGUMENTS_INVALID");
        string operation=args[2],scope=args[3],request=args[4];
        if((operation!="ISSUE" && operation!="SPEND") || !Hex64.IsMatch(scope) ||
           !Hex32.IsMatch(request) || (operation=="SPEND" &&
           (args.Length!=6 || !Hex64.IsMatch(args[5]))) ||
           (operation=="ISSUE" && args.Length!=5)) return Block("SCOPE_INVALID");
        try {
            string full=Canonical(args[1]), nonce;
            string tokenSid;
            using(var identity=WindowsIdentity.GetCurrent()) {
                Require(identity!=null && identity.User!=null,"TOKEN_UNVERIFIABLE");
                tokenSid=identity.User.Value; // Observation only, never independent attestation.
            }
            // OS-enforced exclusive native handle: no portable mkdir lock.
            using(var fs=new FileStream(full,FileMode.Open,FileAccess.ReadWrite,
                FileShare.None,4096,FileOptions.WriteThrough)) {
                VerifyHandle(fs,full);
                nonce=Process(fs,operation,scope,request,args.Length==6?args[5]:null);
                VerifyHandle(fs,full);
            } // Close failure is caught below: never return success on uncertainty.
            Console.WriteLine("CANDIDATE_FLUSHED|"+nonce+"|TOKEN_OBSERVED_NOT_ATTESTED");
            return 0;
        } catch(Exception ex) {
            return Block(ex is IOException?"IO_OR_EXCLUSIVE_DENIED":
                ex is UnauthorizedAccessException?"ACL_OR_PATH_DENIED":
                ex is InvalidDataException?ex.Message:"NATIVE_BOUNDARY_UNVERIFIABLE");
        }
    }
    static int Block(string code) {
        Console.WriteLine("BLOCKED|"+code+"|NO_REPLAY_NO_AUTHORITY");
        return 3;
    }
}
